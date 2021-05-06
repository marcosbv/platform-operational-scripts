const { argv } = require('process')
const request = require('request-promise-native')
const TOKEN=process.env.TOKEN
const ACCOUNT_ID=process.env.ACCOUNT_ID


async function loadAccountUsers() {
    let url = `https://user-management.cloud.ibm.com/v2/accounts/${ACCOUNT_ID}/users`
    const options = {
        json: true,
        headers: {
            authorization: `Bearer ${TOKEN}`
        },
        uri: url,
        method: 'GET'
    }

    let next_url = url;
    let account_user_list = []
    do {
        console.log(`[loadAccountUsers] Calling URL ${url}`)
        const response = await request.get(url, options)
        account_user_list = account_user_list.concat(response.resources)

        if(response.next_url!=null) {
            next_url = `https://user-management.cloud.ibm.com${response.next_url}`
            url = next_url
        } else {
            next_url = null;
        }
    } while(next_url != null)

    console.log(`[loadAccountUsers] Loaded ${account_user_list.length} users.`)
    return account_user_list;
}

async function addUsersToWatsonStudioProject(catalog_id, role, filtered_users) {

   /**
    * Add member to a project call example:
    * 
    * curl -X POST 
  https://api.dataplatform.cloud.ibm.com/v2/projects/2fa104ea-9a06-49d7-9868-c34c8e07a90a/members 
  -H 'Accept: application/json' -H 'Authorization: $TOKEN -H 'Content-Type: application/json,application/json' 
  -H 'cache-control: no-cache' -d '{
    "members": [
        {
			"user_name": "email_address",
			"role": "editor",
			"id":"IBMid-XXXXXX"
        }
    ]
}'
    */

    for(const filtered_user of filtered_users) {
        const members = [{
                user_id : filtered_user.email,
                role: role,
                user_iam_id: filtered_user.iam_id
        }]
       
    
    
        const url = `https://api.dataplatform.cloud.ibm.com/v2/catalogs/${catalog_id}/members`
        const options = {
            json: true,
            uri: url,
            method: 'POST',
            headers: {
                'Accept' : 'application/json',
                'Authorization' : `Bearer ${TOKEN}`,
                'Content-Type' : 'application/json',
                'Cache-Control' : 'no-cache'
            },
            body: {
                members: members
            }
        }
    
        console.log(`[addUsersToWatsonStudioProject] Calling add members with body: \n ${JSON.stringify(options.body)}`)
    
        try {
            const response = await request.post(url, options)
            console.log("[addUsersToCatalog] Response: " + JSON.stringify(response))
        } catch(e) {
            console.error("[addUsersToCatalog] Error: " + e.message);
        }
    
    }
  
}

async function main() {
    const account_users = await loadAccountUsers();
    const project_id = argv[2]
    const role = argv[3]
    const users = argv.slice(4)

    const filtered_users = []
    for(const user of users) {
        const filteredUser = account_users.filter((x) => x.email == user)
        if(filteredUser.length == 0) {
            console.log(`[main] User ${user} not found in this account. Please invite him/her first or check the email spelling.`)
        } else {
            const ibm_id = filteredUser[0].iam_id
            console.log(`[main] User ${user} has ID ${ibm_id}`)
            filtered_users.push(filteredUser[0])
        }
    } 

    await addUsersToWatsonStudioProject(project_id, role, filtered_users)
}


main();