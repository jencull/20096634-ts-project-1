import { APIGatewayProxyResult } from "aws-lambda";
import {
    CognitoIdentityProviderClient,
    InitiateAuthCommand,
    InitiateAuthCommandInput,
} from "@aws-sdk/client-cognito-identity-provider";
import Ajv from "ajv";
// layer paths
import { SignInBody } from "/opt/nodejs/types";
import schema from "/opt/nodejs/types.schema.json";

// from https://github.com/jencull/cognito-demo-app/blob/master/lambda/auth/signin.ts

const ajv = new Ajv();
const isValidBodyParams = ajv.compile<SignInBody>(schema.definitions["SignInBody"] || {});

const client = new CognitoIdentityProviderClient({
    region: process.env.REGION,
});

// changed from ProxyHandler in Cognito demo app to ProxyResult here (as in the signout lambda)
// as handler was causing a 'header mismatch' error
// https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
export const handler = async (event: any): Promise<APIGatewayProxyResult> => {
    try {
        console.log("[EVENT]", event);
        const body = event.body ? JSON.parse(event.body) : undefined;

        if (!isValidBodyParams(body)) {
            return {
                statusCode: 400,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    message: `Incorrect type. Must match SignInBody schema`,
                    schema: schema.definitions["SignInBody"],
                }),
            };
        }

        const signInBody = body as SignInBody;

        const params: InitiateAuthCommandInput = {
            ClientId: process.env.CLIENT_ID!,
            AuthFlow: "USER_PASSWORD_AUTH",
            AuthParameters: {
                USERNAME: signInBody.username,
                PASSWORD: signInBody.password,
            },
        };

        const command = new InitiateAuthCommand(params);
        const { AuthenticationResult } = await client.send(command);

        if (!AuthenticationResult) {
            return {
                statusCode: 500,
                body: JSON.stringify({
                    message: "User signin failed",
                }),
            };
        }

        console.log("Auth Successful");
        const token = AuthenticationResult.IdToken;

        return {
            statusCode: 200,
            headers: {
                // adapted for assignment 2
                "Access-Control-Allow-Headers": "Content-Type,Authorization",
                "Access-Control-Allow-Origin": "http://localhost:3000",
                "Set-Cookie": `token=${token}; SameSite=None; Secure; HttpOnly; Path=/; Max-Age=3600;`,
            },
            body: JSON.stringify({
                message: "Auth successful",
                token: token,
            }),
        };
    } catch (err: any) {
        console.error(err);

        return {
            statusCode: 500,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                message: err.message || err,
            }),
        };
    }
};
