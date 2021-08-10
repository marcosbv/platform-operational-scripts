## Dados Cloud Foundry (orgs/spaces)
mkdir -p data
export UAA_TOKEN=$(ibmcloud iam oauth-tokens | grep UAA | cut -d " " -f5)

set +x

echo "Getting account users..."
ibmcloud account users --output json > users.json
echo "Getting CF orgs and spaces..."
curl -X GET "https://api.us-south.cf.cloud.ibm.com/v2/organizations" -H "Authorization: bearer ${UAA_TOKEN}" -o organizations.json
curl -X GET "https://api.us-south.cf.cloud.ibm.com/v2/spaces" -H "Authorization: bearer ${UAA_TOKEN}" -o spaces.json

for i in `cat organizations.json | grep '"guid"' | cut -d '"' -f4 `
do
    echo "Getting managers, billing managers and auditors for org ${i}"
    curl -X GET "https://api.us-south.cf.cloud.ibm.com/v2/organizations/${i}/managers" -H "Authorization: bearer ${UAA_TOKEN}" -o org_${i}_managers.json
    curl -X GET "https://api.us-south.cf.cloud.ibm.com/v2/organizations/${i}/billing_managers" -H "Authorization: bearer ${UAA_TOKEN}" -o org_${i}_billing_managers.json
    curl -X GET "https://api.us-south.cf.cloud.ibm.com/v2/organizations/${i}/auditors" -H "Authorization: bearer ${UAA_TOKEN}" -o org_${i}_auditors.json
done

for i in `cat spaces.json | grep '"guid"' | cut -d '"' -f4 `
do
    echo "Getting managers, developers and auditors for space ${i}"
    curl -X GET "https://api.us-south.cf.cloud.ibm.com/v2/spaces/${i}/managers" -H "Authorization: bearer ${UAA_TOKEN}" -o space_${i}_managers.json
    curl -X GET "https://api.us-south.cf.cloud.ibm.com/v2/spaces/${i}/developers" -H "Authorization: bearer ${UAA_TOKEN}" -o space_${i}_developers.json
    curl -X GET "https://api.us-south.cf.cloud.ibm.com/v2/spaces/${i}/auditors" -H "Authorization: bearer ${UAA_TOKEN}" -o space_${i}_auditors.json
done

mv *.json ./data