ACCOUNT_NAME=$(ibmcloud account show | grep "Account Name" | cut -c 37-)
ACCESS_GROUPS=$1

shift
USERS=$@

for user in $USERS
do
    echo "Inviting user $user to account $ACCOUNT_NAME and access groups $ACCESS_GROUPS"
    ibmcloud account user-invite $user --access-groups "$ACCESS_GROUPS"
done