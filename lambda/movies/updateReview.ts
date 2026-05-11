import { APIGatewayProxyHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import Ajv from "ajv";
import schema from "/opt/nodejs/types.schema.json";
import { Review } from "/opt/nodejs/types";
import { verifyToken } from "/opt/nodejs/utils";

const ajv = new Ajv();
const isValidReviewPayload = ajv.compile<Review>(schema.definitions["Review"] || {});
const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandler = async (event) => {
    try {
        console.log("[EVENT]", JSON.stringify(event));
        const body = event.body ? JSON.parse(event.body) : undefined;

        // Get movieID from the path {movieID}
        const movieID = event.pathParameters?.movieID;

        // Read Bearer token from Authorization header
        const authHeader = event.headers?.Authorization || event.headers?.authorization;
        const token = authHeader?.replace("Bearer ", "");

        if (!body || !movieID) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "http://localhost:3000" },
                body: JSON.stringify({ message: "Missing body or movie ID" }),
            };
        }

        // Check token exists
        if (!token) {
            return {
                statusCode: 401,
                headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "http://localhost:3000" },
                body: JSON.stringify({ message: "Login required" }),
            };
        }

        // verify token and get username for updating a review
        const decoded: any = await verifyToken(
            token,
            process.env.USER_POOL_ID!,
            process.env.REGION!
        );

        const username = decoded["cognito:username"];

        // add extra info for ajv validation
        body.reviewerID = username;
        body.movieID = Number(movieID);
        body.pk = `m#${movieID}`;
        body.sk = `r#${username}`;

        if (!isValidReviewPayload(body)) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "http://localhost:3000" },
                body: JSON.stringify({
                    message: `Incorrect type. Must match the Review schema`,
                    errors: isValidReviewPayload.errors,
                }),
            };
        }

        const commandInput = {
            TableName: process.env.TABLE_NAME,
            Key: {
                pk: `m#${movieID}`,
                sk: `r#${username}`,
            },
            // Using aliases to avoid ddb reserved word errors (date, text)
            UpdateExpression: "set #text = :text, #reviewDate = :date",
            ExpressionAttributeNames: {
                "#text": "text",
                "#reviewDate": "date",
            },
            ExpressionAttributeValues: {
                ":text": body.text,
                ":date": body.date,
            },
            // Check the review exists and belongs to this user
            ConditionExpression: "attribute_exists(pk) AND attribute_exists(sk)",
        };

        await ddbDocClient.send(new UpdateCommand(commandInput));

        return {
            statusCode: 200,
            headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "http://localhost:3000" },
            body: JSON.stringify({ message: "Review updated" }),
        };
    } catch (error: any) {
        console.error(error);

        // Check if the update failed because the review doesn't exist for this user
        // Can't update something that doesn't exist
        if (error.name === "ConditionalCheckFailedException") {
            return {
                statusCode: 404,
                headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "http://localhost:3000" },
                body: JSON.stringify({ message: "Review not found or you are not authorized to edit it. Please use the 'add review' option." }),
            };
        }

        return {
            statusCode: 500,
            headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "http://localhost:3000" },
            body: JSON.stringify({ error: error.message }),
        };
    }
};

function createDDbDocClient() {
    const ddbClient = new DynamoDBClient({ region: process.env.REGION });
    const marshallOptions = {
        convertEmptyValues: true,
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
    };
    const unmarshallOptions = {
        wrapNumbers: false,
    };
    const translateConfig = { marshallOptions, unmarshallOptions };
    return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}
