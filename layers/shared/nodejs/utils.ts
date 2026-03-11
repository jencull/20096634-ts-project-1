// this file is called /opt/nodejs/utils.js when its transpiled
// thats what is imported to the lambda functions

import { marshall } from "@aws-sdk/util-dynamodb";
import {
    APIGatewayRequestAuthorizerEvent,
    APIGatewayAuthorizerEvent,
    PolicyDocument,
    APIGatewayProxyEvent,
    StatementEffect
} from "aws-lambda";
import axios from "axios";
import jwt from 'jsonwebtoken';
import jwkToPem from "jwk-to-pem";
import { Movie, MovieSource, Review, Reviewer } from "./types";

// entities in dynamodb table
type Entity = Movie | Review | Reviewer;

// maps the movies.ts (MovieSource) info with to the Movie interface that has pk & sk info
// movies.ts (MovieSource) isn't edited and can be updated at any stage without editing the json
// similar to https://github.com/jencull/ds-ts-lab/blob/main/src/05-utilityTypes.ts#L19
// building a new movie object from an 'old' one in the movies.ts seed file
// used in the constructs/dynamodb-table.ts
export const transformMovie = (m: MovieSource): Movie => {
    return {
        pk: `m#${m.id}`,
        sk: `m#${m.id}`,
        id: m.id,
        title: m.title,
        date: m.release_date, // Mapping TMDB release_date to use as LSI sk date
        overview: m.overview
    };
};

// wraps each item in a PUT request
export const generateItem = (entity: Entity) => {
    return {
        PutRequest: {
            Item: marshall(entity),
        },
    };
};

// wraps an array of items into a list of PUT requests
export const generateBatch = (data: Entity[]) => {
    return data.map((e) => {
        return generateItem(e);
    });
};

//utils from cognito-demo-app https://github.com/jencull/cognito-demo-app/blob/master/lambda/utils.ts
export type CookieMap = { [key: string]: string } | undefined;
export type JwtToken = { sub: string; email: string } | null;
export type Jwk = {
    keys: {
        alg: string;
        e: string;
        kid: string;
        kty: "RSA"; // type safety, changed from string
        n: string;
        use: string;
    }[];
};

export const parseCookies = (
    event: APIGatewayRequestAuthorizerEvent | APIGatewayProxyEvent
) => {
    if (!event.headers || !event.headers.Cookie) {
        return undefined;
    }

    const cookiesStr = event.headers.Cookie;
    const cookiesArr = cookiesStr.split(";");

    const cookieMap: CookieMap = {};

    for (let cookie of cookiesArr) {
        const cookieSplit = cookie.trim().split("=");
        cookieMap[cookieSplit[0]] = cookieSplit[1];
    }

    return cookieMap;
};

export const verifyToken = async (
    token: string,
    userPoolId: string | undefined,
    region: string
): Promise<JwtToken> => {
    try {
        const url = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;
        const { data }: { data: Jwk } = await axios.get(url);
        const pem = jwkToPem(data.keys[0]);

        return jwt.verify(token, pem, { algorithms: ["RS256"] }) as JwtToken; // added 'as JwtToken', type for return value 
    } catch (err) {
        console.log(err);
        return null;
    }
};

export const createPolicy = (
    event: APIGatewayAuthorizerEvent,
    effect: StatementEffect
): PolicyDocument => {
    return {
        Version: "2012-10-17",
        Statement: [
            {
                Effect: effect,
                Action: "execute-api:Invoke",
                Resource: [event.methodArn],
            },
        ],
    };
};
