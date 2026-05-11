import { APIGatewayRequestAuthorizerHandler } from "aws-lambda";
import { createPolicy, verifyToken } from "/opt/nodejs/utils"; 

// Updated to read Bearer token from Authorization header instead of cookies,
// since the frontend sends Authorization: Bearer <token> not a cookie.
export const handler: APIGatewayRequestAuthorizerHandler = async (event) => {
  console.log("[EVENT]", event);

  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return {
      principalId: "",
      policyDocument: createPolicy(event, "Deny"),
    };
  }

  const verifiedJwt = await verifyToken(
    token,
    process.env.USER_POOL_ID,
    process.env.REGION!
  );

  return {
    principalId: verifiedJwt ? verifiedJwt.sub!.toString() : "",
    policyDocument: createPolicy(event, verifiedJwt ? "Allow" : "Deny"),
  };
};