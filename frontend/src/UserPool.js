import { CognitoUserPool } from "amazon=cognito-identity-js"

const poolData = {
    UserPoolId: "us-east-1_lOQ9rE92X",
    ClientId: "4ehiqkgllcpj15nag35h9kf4d6"
}

export default new CognitoUserPool(poolData);