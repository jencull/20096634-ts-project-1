import { APIGatewayProxyResult } from "aws-lambda";
import {
    CognitoIdentityProviderClient,
    ConfirmSignUpCommand,
    ConfirmSignUpCommandInput,
} from "@aws-sdk/client-cognito-identity-provider";
import { ConfirmSignUpBody } from "/opt/nodejs/types";
import schema from "/opt/nodejs/types.schema.json";
import Ajv from "ajv";

// from https://github.com/jencull/cognito-demo-app/blob/master/lambda/auth/confirm-signup.ts
// made same change to APIGatewayProxyResult here
const ajv = new Ajv();
const isValidBodyParams = ajv.compile<ConfirmSignUpBody>(
    schema.definitions["ConfirmSignUpBody"] || {}
);

const client = new CognitoIdentityProviderClient({ region: process.env.REGION });

export const handler = async (event: any): Promise<APIGatewayProxyResult> => {
    try {
        console.log("[EVENT]", event);
        const body = event.body ? JSON.parse(event.body) : undefined;

        if (!isValidBodyParams(body)) {
            return {
                statusCode: 500,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    message: `Incorrect type. Must match ConfirmSignUpBody schema`,
                    schema: schema.definitions["ConfirmSignUpBody"],
                }),
            };
        }

        const confirmSignUpBody = body;
        const params: ConfirmSignUpCommandInput = {
            ClientId: process.env.CLIENT_ID!,
            Username: confirmSignUpBody.username,
            ConfirmationCode: confirmSignUpBody.code,
        };

        const command = new ConfirmSignUpCommand(params);
        await client.send(command);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: `User ${confirmSignUpBody.username} successfully confirmed`,
                confirmed: true,
            }),
        };
    } catch (err: any) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: err,
            }),
        };
    }
};
