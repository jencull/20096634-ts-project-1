import { APIGatewayProxyHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    QueryCommand,
    QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { Review } from "/opt/nodejs/types";

// used as a guide https://github.com/jencull/rest-api-stack/blob/master/lambdas/getMovieCastMember.ts
const ddbClient = new DynamoDBClient({ region: process.env.REGION });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

export const handler: APIGatewayProxyHandler = async (event) => {
    try {
        console.log("[EVENT]", JSON.stringify(event));

        const movieID = event.pathParameters?.movieID;

        const reviewer = event.queryStringParameters?.reviewer;

        if (!movieID) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Missing movieID" }),
            };
        }

        let commandInput: QueryCommandInput = {
            TableName: process.env.TABLE_NAME,
        };

        // IF a reviewers username is included in the search then return the review by that user
        // using pk m# for movieID and sk r# for reviewer (username) 
        if (reviewer) {
            commandInput = {
                ...commandInput,
                KeyConditionExpression: "pk = :movieID and sk = :reviewer",
                ExpressionAttributeValues: {
                    ":movieID": `m#${movieID}`,
                    ":reviewer": `r#${reviewer}`,
                },
            };
        // ELSE (where username is not included in search) return all reviews for that movie
        // Making :reviewer just r#, the begins_with finds every review record for that movie
        } else {
            commandInput = {
                ...commandInput,
                KeyConditionExpression: "pk = :movieID and begins_with(sk, :reviewer)",
                ExpressionAttributeValues: {
                    ":movieID": `m#${movieID}`,
                    ":reviewer": "r#",
                },
            };
        }

        const commandOutput = await ddbDocClient.send(new QueryCommand(commandInput));
        const reviews = commandOutput.Items as Review[];

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                movieId: movieID,
                reviewer: reviewer ?? "all",
                data: reviews
            }),
        };
    } catch (error: any) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};

function createDocumentClient() {
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
