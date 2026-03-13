import { APIGatewayProxyHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import Ajv from "ajv";
import schema from "/opt/nodejs/types.schema.json";
import { Review } from "/opt/nodejs/types";

const ajv = new Ajv();
const isValidReviewPayload = ajv.compile<Review>(schema.definitions["Review"] || {});
const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandler = async (event) => {
    try {
        console.log("[EVENT]", JSON.stringify(event));
        const body = event.body ? JSON.parse(event.body) : undefined;

        if (!body) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ message: "Review not included. Please provide review details in request body" }),
            };
        }

        // Pull the real username from the authorizer info
        const authenticatedUser = event.requestContext.authorizer?.principalId;
        
        // make the reviewerID to be the authenticated user's ID
        body.reviewerID = authenticatedUser;

        if (!isValidReviewPayload(body)) {
            return {
                statusCode: 400,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    message: `Review does not match the required format`,
                    schema: schema.definitions["Review"],
                    errors: isValidReviewPayload.errors,
                }),
            };
        }

        // review as defined in the db table
        const reviewItem = {
            pk: `m#${body.movieID}`,
            sk: `r#${body.reviewerID}`,
            movieID: Number(body.movieID),
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
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ message: "Review added" }),
        };
    } catch (error: any) {
        console.error(error);
        return {
            statusCode: 500,
            headers: { "content-type": "application/json" },
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

