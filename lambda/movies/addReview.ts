import { APIGatewayProxyHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
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

        // Read Bearer token from Authorization header (frontend sends Authorization: Bearer <token>)
        const authHeader = event.headers?.Authorization || event.headers?.authorization;
        const token = authHeader?.replace("Bearer ", "");

        const body = event.body ? JSON.parse(event.body) : undefined;

        // check body exists
        if (!body) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "http://localhost:3000" },
                body: JSON.stringify({
                    message: "Review not included. Please provide details"
                }),
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

        // verify token and get username  for adding a review
        const decoded: any = await verifyToken(
            token,
            process.env.USER_POOL_ID,
            process.env.REGION!
        );

        const username = decoded["cognito:username"];

        // adding additional info for ajv/db
        body.reviewerID = username;
        body.pk = `m#${body.movieID}`;
        body.sk = `r#${username}`;

        // check against ajv
        if (!isValidReviewPayload(body)) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "http://localhost:3000" },
                body: JSON.stringify({
                    message: `Review does not match the required format`,
                    schema: schema.definitions["Review"],
                    errors: isValidReviewPayload.errors,
                }),
            };
        }

        const reviewItem = {
            pk: body.pk,
            sk: body.sk,
            movieID: body.movieID,
            reviewerID: body.reviewerID,
            date: body.date,
            text: body.text,
        };

        await ddbDocClient.send(
            new PutCommand({
                TableName: process.env.TABLE_NAME,
                Item: reviewItem,
            })
        );

        return {
            statusCode: 201,
            headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "http://localhost:3000" },
            body: JSON.stringify({ message: "Review added" }),
        };

    } catch (error: any) {
        console.error(error);
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
    const unmarshallOptions = { wrapNumbers: false };
    const translateConfig = { marshallOptions, unmarshallOptions };
    return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}

