export PLATFORM_SCRIPTS_PATH=`pwd`

alias node-local-setup='npm install'
alias format-json-output='python -m json.tool'
alias get-ibm-cloud-resources='ibmcloud resource search "family:ims OR type:(cf-application OR resource-instance OR cf-service-instance)"'
alias set-accountid-variable='export ACCOUNT_ID=$(ibmcloud account show|grep "Account ID" | cut -c 37-68 )'
alias get-ibm-cloud-token='export TOKEN=$(ibmcloud iam oauth-tokens|cut -d " " -f5)'
alias invite-to-ibm-cloud='f() { ${PLATFORM_SCRIPTS_PATH}/invite-users-to-platform.sh $@;}; f'
alias invite-to-watson-studio='f() { cd ${PLATFORM_SCRIPTS_PATH}; node invite-users-watson-studio.js $@; cd ${OLDPWD}}; f'
alias call-ibm-cloud-api='f() { curl -H "Authorization: Bearer $TOKEN" $@;}; f'

cat ${PLATFORM_SCRIPTS_PATH}/short_summary.txt