const UserManagementV1 = require('@ibm-cloud/platform-services/user-management/v1')
const IAMAccessGroupsV2 = require('@ibm-cloud/platform-services/iam-access-groups/v2')
const IAMPolicyManagementV1 = require('@ibm-cloud/platform-services/iam-policy-management/v1')

const request = require('request-promise-native')
const fs = require('fs');

const accountOrgs = require('./data/account_orgs.json')

const {BearerTokenAuthenticator} = require('@ibm-cloud/platform-services/auth')

const authenticator = new BearerTokenAuthenticator({
    bearerToken: process.env.TOKEN.trim()
})

const accountId = process.env.ACCOUNT_ID

const userManagement = new UserManagementV1({
    authenticator
})

const accessManagement = new IAMAccessGroupsV2({
    authenticator
})

const policyManagement = new IAMPolicyManagementV1({
    authenticator
})

async function listAllUsers() {
    let users = []
    let next_url = undefined
    while(true) {
        let u;
      
        const params = {
            accountId: accountId,
            limit:100,
            start: next_url
        }
        u = await userManagement.listUsers(params)
        users = users.concat(u.result.resources)

        
        if(!u.result.next_url) {
            break;
        } else {
            const url = new URL(u.result.next_url, 'http://fake.com')
            next_url = url.searchParams.get('_start')
        }
    }

    return {
        resources: users,
        count: users.length
    }

}

async function listAccessGroupsForUser(user) {
    let groups = []
    let next_url = undefined
    while(true) {
        let u;
       
        const params = {
            accountId: accountId,
            iamId: user.iam_id
        }
        u = await accessManagement.listAccessGroups(params)
        groups = groups.concat(u.result.groups)

        
        if(!u.result.next_url) {
            break;
        } else {
            const url = new URL(u.result.next_url, 'http://fake.com')
            next_url = url.searchParams.get('_start')
        }
    }

    return {
        resources: groups,
        count: groups.length
    }

}

async function listPoliciesForUser(user) {
   
    const params = {
        accountId: accountId,
        iamId: user.iam_id,
        state: 'active',
        type: 'access'
    }

    const policies = await policyManagement.listPolicies(params)
    return policies
}

async function callSoftlayerRestApi(httpMethod, serviceName, initParameter, method, parameters) {
    const url = `https://api.softlayer.com/rest/v3/${serviceName}${initParameter!=null? '/' + initParameter : ''}/${method}`
    let options = {
        headers: {
            authorization: `Bearer ${process.env.TOKEN}`
        }, 
        method: httpMethod,
        url: url,
        json: true
    }

    if(parameters!=null) {
       const params = {
           parameters: parameters
       }

       options.body = params
    }

    console.log(url)
    const response = await request(options)
    return response;

}

async function migrateCFPermissions(realmUserId1, realmUserId2) {
    const allUsers = require('./data/users.json')
    const allOrgs = require('./data/organizations.json')
    const allSpaces = require('./data/spaces.json')

    const allJsonFiles = fs.readdirSync('./data')

    const userInfo = allUsers.filter(x => x.ibmUniqueId == realmUserId1);
    const secondUserInfo = allUsers.filter(x => x.ibmUniqueId == realmUserId2);
    
    const userPermissions = []
    for(const jsonFileName of allJsonFiles) {
        const jsonFile = fs.readFileSync(`./data/${jsonFileName}`)
        const jsonObj = JSON.parse(jsonFile.toString())

        if(jsonObj.resources) {
            const metadataInfo = jsonObj.resources.filter((x) => {
                if(x.metadata) {
                    return x.metadata.guid == userInfo[0].uaaGuid
                } else {
                    return false;
                }
            })

            if(metadataInfo.length > 0) {
                const fileNameParts = jsonFileName.split('_')
                const objType = fileNameParts[0]
                const objId = fileNameParts[1]
                const objRole = fileNameParts[2].split('.')[0]
                let obj = null;

                if(objType == "org") {
                    obj = allOrgs.resources.filter((x) => x.metadata.guid == objId)
                } else {
                    obj = allSpaces.resources.filter((x) => x.metadata.guid == objId)
                }

                if(obj.length > 0) {
                    let info = {
                        type: objType,
                        id: obj[0].metadata.guid,
                        description: obj[0].entity.name,
                        role: objRole,
                        user_id : secondUserInfo[0].uaaGuid
                    }

                    if(objType == "space") {
                        const filteredOrg = allOrgs.resources.filter((x) => x.metadata.guid == obj[0].entity.organization_guid)
                        if(filteredOrg.length > 0) {
                            info.org_id = filteredOrg[0].metadata.guid
                        }
                    }
                    userPermissions.push(info)
                }
                
            }
        }
    }

    /*
    console.log(`User has ${userPermissions.length} permissions in Cloud Foundry.
Please insert the below commands in a terminal in order to give CF permissions: \n\n`)
    
    for(const permission of userPermissions) {
        if(permission.type == "org") {
            console.log(`ibmcloud account org-role-set ${permission.user_id} ${permission.id} ${permission.role}`)
        } else {
            console.log(`ibmcloud account space-role-set ${permission.user_id} ${permission.org_id} ${permission.id} ${permission.role}`)
        }
    }
    */

    const usersAddToOrg = new Map()
    for(const permission of userPermissions) {
        console.log(`Adding Cloud Foundry permission: ${permission.type == "org" ? "org-role-set" : "space-role-set"} ${permission.description} ${permission.role} ${permission.type == "space" ? "(org: " + permission.org_id + ")" : ""}`)

        const org_uuid = permission.type == "org" ? permission.id : permission.org_id
        let usersList = usersAddToOrg.get(org_uuid)
        if(usersList==null || usersList == undefined) {
            usersList = []
            usersAddToOrg.set(org_uuid, [permission.user_id])
        }

        if(usersList.indexOf(permission.user_id) == -1) {
            await addUserToOrg(permission)
            usersList.push(permission.user_id)
        }
        
        try {
            await setOrgSpaceRole(permission)
        } catch(e) {
            console.error(e)
        }
        
    }
}

async function addUserToOrg(obj) {
    const org_uuid = obj.type == "org" ? obj.id : obj.org_id
    const url = `https://mccp.us-south.cf.cloud.ibm.com/v2/organizations/${org_uuid}/users/${obj.user_id}`
    await basePutRequest(url)
}

async function setOrgSpaceRole(obj) {
    const type = obj.type == "org" ? "organizations" : "spaces"
    const url = `https://mccp.us-south.cf.cloud.ibm.com/v2/${type}/${obj.id}/${obj.role == "billing" ? "billing_managers" : obj.role}/${obj.user_id}`
    await basePutRequest(url)
}
async function basePutRequest(url) {

    const options = {
        url: url,
        method: 'PUT',
        headers: {
            authorization: `bearer ${process.env.UAA_TOKEN}`
        },
        resolveWithFullResponse: true
    }

    console.log(`PUT ${url}`)
    const response = await request.put(url, options);
    const statusCode = response.statusCode;
    console.log("Response: " + statusCode);

    if(statusCode >= 400) {
        console.log("Body: " + response.data);
    }


} 

async function migrateUsers(realm1, realm2, users) {
    const platformUsers = await listAllUsers()

    for(const iamEmail of users) {
        const ibmIdUser = platformUsers.resources.filter((x) =>  (x.user_id == iamEmail || x.email == iamEmail)  && x.realm == realm1 )
        const appIdUser = platformUsers.resources.filter((x) =>  (x.user_id == iamEmail || x.email == iamEmail) && x.realm == realm2 )
        

        if(ibmIdUser.length == 0) {
            console.log(`User ${iamEmail}: Realm 1 ID not found.`)
            continue;
        }

        /*
        if(appIdUser.length == 0) {
            console.log(`User ${iamEmail}: AppID not found.`)
            continue;
        }
*/
        console.log(`User ${iamEmail}: Realm ${realm1}: ${ibmIdUser[0].iam_id} Realm ${realm2}: ${appIdUser.length > 0 ? appIdUser.map(x => x.iam_id): 'NONE'}`)
        const accessGroupsForUser = await listAccessGroupsForUser(ibmIdUser[0])
        
        console.log(`Returned ${accessGroupsForUser.resources.length} access groups for realm1 ${ibmIdUser[0].id}: ${accessGroupsForUser.resources.map(x=>x.name)}`)
        const policies = await listPoliciesForUser(ibmIdUser[0])

        console.log(`Returned ${policies.result.policies.length} policies directly assigned to user.`)

        const slUsers = await callSoftlayerRestApi('GET', 'SoftLayer_Account', null, 'getUsers', null);
        const slUserRealm1 = slUsers.filter((x) => x.iamId == ibmIdUser[0].iam_id)
        console.log(`Softlayer user: ${slUserRealm1[0].id}`)

        const slPermissionsUser1 = await callSoftlayerRestApi('GET','SoftLayer_User_Customer', slUserRealm1[0].id, 'getPermissions')
        console.log(`User has ${slPermissionsUser1.length} permissions set.`)
        
        const bareMetalIds = await callSoftlayerRestApi('GET','SoftLayer_User_Customer', slUserRealm1[0].id, 'getAllowedHardwareIds')
        const dedicatedHostIds = await callSoftlayerRestApi('GET','SoftLayer_User_Customer', slUserRealm1[0].id, 'getAllowedDedicatedHostIds')
        const vsiHostIds = await callSoftlayerRestApi('GET','SoftLayer_User_Customer', slUserRealm1[0].id, 'getAllowedVirtualGuestIds')
        
        console.log(`Access to devices: hardware=${JSON.stringify(bareMetalIds)} , dedicatedHost=${JSON.stringify(dedicatedHostIds)} , virtualGuests=${JSON.stringify(vsiHostIds)}`)
        for(const appIdU of appIdUser) {
            for(const accessGroup of accessGroupsForUser.resources) {
                if(accessGroup.name == "Public Access") {
                    continue;
                }
                try {
                    console.log(`Adding access group ${accessGroup.name} to realm 2 id ${appIdU.id}`)
                    const params = {
                         accessGroupId: accessGroup.id,
                         members: [
                             {
                                 iam_id: appIdU.iam_id,
                                 type: 'user'
                             }
                         ]
                    }

                    await accessManagement.addMembersToAccessGroup(params)
                } catch(e) {
                    console.error(e)
                }
            }

            for(const policy of policies.result.policies) {
                const newPolicy = {
                    type: policy.type,
                    subjects: [{
                        attributes: [
                            {
                                name: "iam_id",
                                value: appIdU.iam_id
                            }
                        ]
                    }],
                    roles: policy.roles.map((x) => {return {role_id: x.role_id}}),
                    resources: policy.resources,
                    description: policy.description
                }

                try {
                    console.log(`Adding existent policy '${policy.id}' to realm 2 id  ${appIdU.id}`)
                    const newPolicyResult = await policyManagement.createPolicy(newPolicy)
                    console.log(`New policy ID: ${newPolicyResult.result.id}`)
                } catch(e) {
                    console.error(e)
                }
            }

            if(slPermissionsUser1.length > 0) {
                const slUserRealm2 = slUsers.filter((x) => x.iamId == appIdU.iam_id)
                console.log(`Softlayer user realm 2: ${slUserRealm2[0].id}`)
                
                if(slUserRealm2.length > 0) {
                    console.log('Adding Softlayer permissions')
                    await callSoftlayerRestApi('POST', 'SoftLayer_User_Customer', slUserRealm2[0].id, 'addBulkPortalPermission', [slPermissionsUser1.map((x) => {return {keyName: x.keyName}})]);

                    if(bareMetalIds.length > 0) {
                        console.log(`Adding permissions to ${bareMetalIds.length} bare metals...`)
                        await callSoftlayerRestApi('POST', 'SoftLayer_User_Customer', slUserRealm2[0].id, 'addBulkHardwareAccess', [bareMetalIds] );
                    }

                    if(vsiHostIds.length > 0) {
                        console.log(`Adding permissions to ${vsiHostIds.length} virtual servers...`)
                        await callSoftlayerRestApi('POST', 'SoftLayer_User_Customer', slUserRealm2[0].id, 'addBulkVirtualGuestAccess', [vsiHostIds] );
                    }

                    if(dedicatedHostIds.length > 0) {
                        console.log(`Adding permissions to ${dedicatedHostIds.length} dedicated hosts...`)
                        await callSoftlayerRestApi('POST', 'SoftLayer_User_Customer', slUserRealm2[0].id, 'addBulkDedicatedHostAccess', [dedicatedHostIds] );
                    }
                }


                migrateCFPermissions(ibmIdUser[0].iam_id, appIdU.iam_id)
                
            }

            
        }

        

    }


}

migrateUsers(process.argv[2], process.argv[3], process.argv.slice(4) || [])