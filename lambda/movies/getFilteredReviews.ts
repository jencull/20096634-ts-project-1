import { APIGatewayProxyHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    QueryCommand,
    QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { Review } from "/opt/nodejs/types";

// used as a guide https://github.com/jencull/rest-api-stack/blob/master/lambdas/getMovieCastMember.ts
const ddbDocClient = createDocumentClient();

export const handler: APIGatewayProxyHandler = async (event) => {
    try {
        console.log("[EVENT]", JSON.stringify(event));

        const movieID = event.queryStringParameters?.movie;
        const publishedDate = event.queryStringParameters?.published;

        // Check if movieID and published date are included
        if (!movieID || !publishedDate) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Missing movieID or date published info" }),
            };
        }
        // Using aliases to avoid ddb reserved words (date)
        // begins_with here returns the info based on the partial match outlined in the project spec 1995-05
        // but will also return info if just the year or the full date is put in
        const commandInput: QueryCommandInput = {
            TableName: process.env.TABLE_NAME,
            IndexName: "reviewDateIx", // check LSI for date
            KeyConditionExpression: "pk = :movieID and begins_with(#reviewDate, :dateValue)",
            ExpressionAttributeNames: {
                "#reviewDate": "date",
            },
            ExpressionAttributeValues: {
                ":movieID": `m#${movieID}`,
                ":dateValue": publishedDate,
            },
        };

        const commandOutput = await ddbDocClient.send(new QueryCommand(commandInput));
        const items = commandOutput.Items || [];

        // removes the pk and sk so that they aren't displayed to the end user
        // guide: https://github.com/jencull/ds-ts-lab/blob/main/src/02-functions.ts#L69
        const reviews = items.map((item) => ({
            movieID: item.movieID,
            reviewerID: item.reviewerID,
            date: item.date,
            text: item.text
        }));

        return {
            statusCode: 200,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
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
