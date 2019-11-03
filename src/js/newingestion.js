import { groupBy } from 'lodash/collection';

export function buildGroupJsonNew(chunk) {
    let queries = {};
    queries.properties = {};
    queries.properties.statement = 'UNWIND {props} AS prop MERGE (n:Group {objectid: prop.source}) SET n += prop.map';
    queries.properties.props = [];

    for (let group of chunk) {
        let properties = group.Properties;
        let identifier = group.ObjectIdentifier;
        let aces = group.Aces;
        let members = group.Members;

        queries.properties.props.push({source:identifier, map: properties})

        processAceArrayNew(aces, identifier, 'Group', queries);

        let format = ['', 'Group', 'MemberOf', '{isacl: false}']
        let grouped = groupBy(members || [], 'MemberType');
        for (let group in grouped){
            format[0] = group;
            let props = grouped[group].filter(g => {
                return g.MemberId != null;
            }).map(g => {
                return {source: g.MemberId, target: identifier}
            });

            insertNew(queries, format, props);
        }
    }
    return queries;
}

export function buildComputerJsonNew(chunk) {
    let queries = {};
    queries.properties = {};
    queries.properties.statement =
        'UNWIND {props} AS prop MERGE (n:Computer {objectid:prop.source}) SET n += prop.map';
    queries.properties.props = [];

    for (let computer of chunk) {
        let identifier = computer.ObjectIdentifier;
        let properties = computer.Properties;
        let localAdmins = computer.LocalAdmins;
        let rdp = computer.RemoteDesktopUsers;
        let primaryGroup = computer.PrimaryGroupSid;
        let allowedToAct = computer.AllowedToAct;
        let dcom = computer.DcomUsers;
        let psremote = computer.PsRemoteUsers;
        let allowedToDelegate = computer.AllowedToDelegate;
        let sessions = computer.Sessions;
        let aces = computer.Aces;

        queries.properties.props.push({ source: identifier, map: properties });

        processAceArrayNew(aces, identifier, 'Computer', queries);

        let format = ['Computer', 'Group', 'MemberOf', '{isacl:false}'];
        if (primaryGroup !== null) {
            insertNew(queries, format, {
                source: identifier,
                target: primaryGroup,
            });
        }

        format = ['Computer', 'Computer', 'AllowedToDelegate', '{isacl:false}'];

        let props = (allowedToDelegate || []).map(delegate => {
            return { source: identifier, target: delegate };
        });

        insertNew(queries, format, props);
        
        format = ['', 'Computer', 'AllowedToAct', '{isacl:false}'];
        grouped = groupBy(allowedToAct || [], 'MemberType');
        for (let group in grouped) {
            format[0] = group;
            props = grouped[group].map(group => {
                return { source: group.MemberId, target: identifier };
            });
            insertNew(queries, format, props);
        }

        format = ['Computer', 'User', 'HasSession', '{isacl:false}'];
        props = (sessions || []).map(session => {
            return { source: session.ComputerId, target: session.UserId };
        });
        insertNew(queries, format, props);

        format = ['', 'Computer', '', '{isacl:false, fromgpo: false}'];
        let grouped = groupBy(localAdmins || [], 'MemberType');
        for (let group in grouped) {
            format[0] = group;
            format[2] = 'AdminTo';
            props = grouped[group].map(group => {
                return { source: group.MemberId, target: identifier };
            });
            insertNew(queries, format, props);
        }

        grouped = groupBy(rdp || [], 'MemberType');
        for (let group in grouped) {
            format[0] = group;
            format[2] = 'CanRDP';
            props = grouped[group].map(group => {
                return { source: group.MemberId, target: identifier };
            });
            insertNew(queries, format, props);
        }

        grouped = groupBy(dcom || [], 'MemberType');
        for (let group in grouped) {
            format[0] = group;
            format[2] = 'ExecuteDCOM';
            props = grouped[group].map(group => {
                return { source: group.MemberId, target: identifier };
            });
            insertNew(queries, format, props);
        }

        grouped = groupBy(psremote || [], 'MemberType');
        for (let group in grouped) {
            format[0] = group;
            format[2] = 'CanPSRemote';
            props = grouped[group].map(group => {
                return { source: group.MemberId, target: identifier };
            });
            insertNew(queries, format, props);
        }
    }
    return queries;
}

export function buildUserJsonNew(chunk) {
    let queries = {};
    queries.properties = {
        statement:
            'UNWIND {props} AS prop MERGE (n:User {objectid: prop.sourceid}) SET n += prop.map',
        props: [],
    };

    for (let user of chunk) {
        let properties = user.Properties;
        let identifier = user.ObjectIdentifier;
        let primaryGroup = user.PrimaryGroupSid;
        let allowedToDelegate = user.AllowedToDelegate;
        let spnTargets = user.SPNTargets;
        let aces = user.Aces;

        processAceArrayNew(aces, identifier, 'User', queries);

        queries.properties.props.push({
            sourceid: identifier,
            map: properties,
        });

        let format = ['User', 'Group', 'MemberOf', '{isacl: false}'];
        if (primaryGroup !== null) {
            insertNew(queries, format, {
                source: identifier,
                target: primaryGroup,
            });
        }

        format = ['User', 'Computer', 'AllowedToDelegate', '{isacl: false}'];
        let props = allowedToDelegate.map(x => {
            return { source: identifier, target: x };
        });

        insertNew(queries, format, props);

        processSPNTargetArrayNew(spnTargets, identifier, queries);
    }
    return queries;
}

export function buildGpoJsonNew(chunk){
    let queries = {};
    queries.properties = {
        statement: 'UNWIND {props} AS prop MERGE (n:GPO {objectid: prop.source}) SET n+= prop.map',
        props: []
    }

    for (let gpo of chunk){
        let identifier = gpo.ObjectIdentifier;
        let aces = gpo.Aces;
        let properties = gpo.Properties;

        queries.properties.props.push({source: identifier, map: properties})
        processAceArrayNew(aces, identifier, 'GPO', queries);
    }

    return queries;
}

export function buildOuJsonNew(chunk) {
    let queries = {};
    queries.properties = {
        statement:
            'UNWIND {props} AS prop MERGE (n:OU {objectid: prop.source}) SET n+= prop.map',
        props: [],
    };

    for (let ou of chunk) {
        let properties = ou.Properties;
        let users = ou.Users;
        let computers = ou.Computers;
        let childOus = ou.ChildOus;
        let rdpUsers = ou.RemoteDestopUsers;
        let admins = ou.LocalAdmins;
        let dcomUsers = ou.DcomUser;
        let psRemoteUsers = ou.PSRemoteUsers;

        let identifier = ou.ObjectIdentifier;
        let aces = ou.Aces;

        processAceArrayNew(aces, identifier, 'Domain', queries);

        queries.properties.props.push({ source: identifier, map: properties });

        let props = users.map(user => {
            return { source: identifier, target: user };
        });
        let format = ['OU', 'User', 'Contains', '{isacl: false}'];

        insertNew(queries, format, props);

        props = computers.map(computer => {
            return { source: identifier, target: computer };
        });
        format = ['OU', 'Computer', 'Contains', '{isacl: false}'];

        insertNew(queries, format, props);

        props = childOus.map(ou => {
            return { source: identifier, target: ou };
        });

        format = ['OU', 'OU', 'Contains', '{isacl: false}'];

        insertNew(queries, format, props);

        format = ['', 'Computer', '', '{isacl: false, fromgpo: true}'];

        let grouped = groupBy(admins, 'MemberType');
        for (let x in grouped) {
            format[0] = x;
            format[2] = 'AdminTo';
            let flattened = computers.flatMap(computer => {
                return grouped[x].map(admin => {
                    return { source: admin.MemberId, target: computer };
                });
            });

            insertNew(queries, format, flattened);
        }

        grouped = groupBy(psRemoteUsers, 'MemberType');
        for (let x in grouped) {
            format[0] = x;
            format[2] = 'CanPSRemote';
            let flattened = computers.flatMap(computer => {
                return grouped[x].map(admin => {
                    return { source: admin.MemberId, target: computer };
                });
            });

            insertNew(queries, format, flattened);
        }

        grouped = groupBy(dcomUsers, 'MemberType');
        for (let x in grouped) {
            format[0] = x;
            format[2] = 'ExecuteDCOM';
            let flattened = computers.flatMap(computer => {
                return grouped[x].map(admin => {
                    return { source: admin.MemberId, target: computer };
                });
            });

            insertNew(queries, format, flattened);
        }

        grouped = groupBy(rdpUsers, 'MemberType');

        for (let x in grouped) {
            format[0] = x;
            format[2] = 'CanRDP';
            let flattened = computers.flatMap(computer => {
                return grouped[x].map(admin => {
                    return { source: admin.MemberId, target: computer };
                });
            });

            insertNew(queries, format, flattened);
        }
    }
    return queries;
}

export function buildDomainJsonNew(chunk) {
    let queries = {};
    queries.properties = {
        statement:
            'UNWIND {props} AS prop MERGE (n:Domain {objectid: prop.source}) SET n+= prop.map',
        props: [],
    };

    for (let domain of chunk) {
        let properties = domain.Properties;
        let users = domain.Users;
        let computers = domain.Computers;
        let childOus = domain.ChildOus;
        let rdpUsers = domain.RemoteDestopUsers;
        let admins = domain.LocalAdmins;
        let dcomUsers = domain.DcomUser;
        let psRemoteUsers = domain.PSRemoteUsers;
        let identifier = domain.ObjectIdentifier;
        let aces = domain.Aces;

        processAceArrayNew(aces, identifier, 'Domain', queries);

        queries.properties.props.push({
            source: identifier,
            map: properties,
        });

        let props = users.map(user => {
            return { source: identifier, target: user };
        });
        let format = ['Domain', 'User', 'Contains', '{isacl: false}'];

        insertNew(queries, format, props);

        props = computers.map(computer => {
            return { source: identifier, target: computer };
        });
        format = ['Domain', 'Computer', 'Contains', '{isacl: false}'];

        insertNew(queries, format, props);

        props = childOus.map(ou => {
            return { source: identifier, target: ou };
        });

        format = ['Domain', 'OU', 'Contains', '{isacl: false}'];

        insertNew(queries, format, props);

        format = ['', 'Computer', '', '{isacl: false, fromgpo: true}'];

        let grouped = groupBy(admins, 'MemberType');
        for (let x in grouped) {
            format[0] = x;
            format[2] = 'AdminTo';
            let flattened = computers.flatMap(computer => {
                return grouped[x].map(admin => {
                    return { source: admin.MemberId, target: computer };
                });
            });

            insertNew(queries, format, flattened);
        }

        grouped = groupBy(psRemoteUsers, 'MemberType');
        for (let x in grouped) {
            format[0] = x;
            format[2] = 'CanPSRemote';
            let flattened = computers.flatMap(computer => {
                return grouped[x].map(admin => {
                    return { source: admin.MemberId, target: computer };
                });
            });

            insertNew(queries, format, flattened);
        }

        grouped = groupBy(dcomUsers, 'MemberType');
        for (let x in grouped) {
            format[0] = x;
            format[2] = 'ExecuteDCOM';
            let flattened = computers.flatMap(computer => {
                return grouped[x].map(admin => {
                    return { source: admin.MemberId, target: computer };
                });
            });

            insertNew(queries, format, flattened);
        }

        grouped = groupBy(rdpUsers, 'MemberType');

        for (let x in grouped) {
            format[0] = x;
            format[2] = 'CanRDP';
            let flattened = computers.flatMap(computer => {
                return grouped[x].map(admin => {
                    return { source: admin.MemberId, target: computer };
                });
            });

            insertNew(queries, format, flattened);
        }
    }

    return queries;
}

const baseInsertStatement =
    'UNWIND {props} AS prop MERGE (n:{0} {objectid: prop.source}) MERGE (m:{1} {objectid: prop.target}) MERGE (n)-[r:{2} {3}]->(m)';

/**
 * Inserts a query into the queries table
 *
 * @param {*} queries - Query object being built
 * @param {*} formatProps - SourceLabel, TargetLabel, EdgeType, Edge Props
 * @param {*} queryProp - array of query props
 */
function insertNew(queries, formatProps, queryProps) {
    if (formatProps.length < 4) {
        throw new NotEnoughArgumentsException();
    }
    if (queryProps.length == 0) {
        return;
    }
    let hash = `${formatProps[0]}-${formatProps[1]}-${formatProps[2]}`;
    if (queries[hash]) {
        queries[hash].props = queries[hash].props.concat(queryProps);
    } else {
        queries[hash] = {};
        if (formatProps.length < 4) {
            throw new NotEnoughArgumentsException();
        }
        queries[hash].statement = baseInsertStatement.formatn(...formatProps);
        queries[hash].props = [].concat(queryProps);
    }
}

function processAceArrayNew(aces, objectid, objecttype, queries) {
    var convertedAces = aces.flatMap(ace => {
        let pSid = ace.PrincipalSID;
        let pType = ace.PrincipalType;
        let right = ace.RightName;
        let aceType = ace.AceType;

        if (objectid == pSid) {
            return null;
        }

        let rights = [];

        //Process the right/type to figure out the ACEs we need to add
        if (aceType === 'All') {
            rights.push('AllExtendedRights');
        } else if (aceType === 'User-Force-Change-Password') {
            rights.push('ForceChangePassword');
        } else if (aceType === 'AddMember') {
            rights.push('AddMember');
        } else if (aceType === 'AllowedToAct') {
            rights.push('AddAllowedToAct');
        } else if (right === 'ExtendedRight') {
            rights.push(aceType);
        }

        if (right === 'GenericAll') {
            rights.push('GenericAll');
        }

        if (right === 'WriteDacl') {
            rights.push('WriteDacl');
        }

        if (right === 'WriteOwner') {
            rights.push('WriteOwner');
        }

        if (right === 'GenericWrite') {
            rights.push('GenericWrite');
        }

        if (right === 'Owner') {
            rights.push('Owns');
        }

        if (right === 'ReadLAPSPassword') {
            rights.push('ReadLAPSPassword');
        }

        return rights.map(right => {
            return { pSid: pSid, right: right, pType: pType };
        });
    });

    convertedAces = convertedAces.filter(ace => {
        return ace != null;
    })

    var grouped = groupBy(convertedAces, 'right');
    let format = ['', objecttype, '', '{isacl: true}'];
    for (let right in grouped) {
        let innerGrouped = groupBy(grouped[right], 'pType');
        for (let inner in innerGrouped) {
            format[0] = inner;
            format[2] = right;
            var mapped = innerGrouped[inner].map(x => {
                return { source: objectid, target: x.pSid };
            });
            insertNew(queries, format, mapped);
        }
    }
}

function processSPNTargetArrayNew(spns, objectid, queries) {
    let format = ['User', 'Computer', '', '{isacl: false, port: prop.port}'];
    let grouped = groupBy(spns, 'Service');
    for (let group in grouped) {
        format[2] = group;
        let props = grouped[group].map(spn => {
            return {
                source: objectid,
                target: spn.ComputerSid,
                port: spn.Port,
            };
        });

        insertNew(queries, format, props);
    }
}