export PLATFORM_SCRIPTS_PATH=`pwd`

alias node-local-setup='npm install'
alias format-json-output='python -m json.tool'
alias get-ibm-cloud-resources='ibmcloud resource search "family:ims OR type:(cf-application OR resource-instance OR cf-service-instance)"'
alias set-accountid-variable='export ACCOUNT_ID=$(ibmcloud account show|grep "Account ID" | cut -c 37-68 )'
alias get-ibm-cloud-token='export TOKEN=$(ibmcloud iam oauth-tokens| grep Bearer | cut -d " " -f5)'
alias get-uaa-token='export UAA_TOKEN=$(ibmcloud iam oauth-tokens | grep UAA | cut -d " " -f5)'
alias invite-to-ibm-cloud='f() { ${PLATFORM_SCRIPTS_PATH}/invite-users-to-platform.sh $@;}; f'
alias invite-to-watson-studio='f() { cd ${PLATFORM_SCRIPTS_PATH}; node invite-users-watson-studio.js $@; cd ${OLDPWD}}; f'
alias call-ibm-cloud-api='f() { curl -H "Authorization: Bearer $TOKEN" $@;}; f'
alias create-temporary-api-key='export API_KEY=$(ibmcloud iam api-key-create ___temp_key -d "___temporary_key_created_by_program" -q | grep "API Key" | cut -c 15-)'
alias remove-temporary-api-key='unset API_KEY && ibmcloud iam api-key-delete ___temp_key -f'
alias migrate-realm-permissions='get-ibm-cloud-token;set-accountid-variable;get-uaa-token;node migrate-permissions-between-realms '

cat ${PLATFORM_SCRIPTS_PATH}/short_summary.txt