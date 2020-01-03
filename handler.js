const aws = require("aws-sdk");
const ses = new aws.SES();
const dynamodb = new aws.DynamoDB();
const myEmail = process.env.EMAIL;
const myDomain = process.env.DOMAIN;

function generateResponse(code, payload) {
  return {
    statusCode: code,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true
    },
    body: JSON.stringify(payload)
  };
}

function generateError(code, err) {
  console.log(err);
  return {
    statusCode: code,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true
    },
    body: JSON.stringify(err.message)
  };
}

function generateEmailParams(body) {
  const { name, email, content } = JSON.parse(body);
  if (!(email && name && content)) {
    throw new Error(
      "Missing parameters! Make sure to add parameters 'email', 'name', 'content'."
    );
  }

  return {
    Source: myEmail,
    Destination: { ToAddresses: [myEmail] },
    ReplyToAddresses: [email],
    Message: {
      Body: {
        Text: {
          Charset: "UTF-8",
          Data: `Message sent from: ${email} \nBy: ${name} \nMessage: ${content}`
        }
      },
      Subject: {
        Charset: "UTF-8",
        Data: `You received a message from ${myDomain}!`
      }
    }
  };
}

function generateCommentParams(body) {
  const { name, comment, postName } = JSON.parse(body);
  let date = new Date();
  let dd = date.getDate();
  let mm = date.getMonth() + 1; //January is 0!
  let yyyy = date.getFullYear();
  date = mm + "/" + dd + "/" + yyyy;
  let uniqueID =
    Math.random()
      .toString(36)
      .substring(2, 15) +
    Math.random()
      .toString(36)
      .substring(2, 15);

  if (!(name && comment)) {
    throw new Error(
      "Missing parameters! Make sure to add parameters 'name', 'content'."
    );
  }
  return {
    TableName: "comments",
    Item: {
      userID: {
        S: uniqueID
      },
      name: {
        S: name
      },
      comment: { S: comment },
      postID: { S: postName },
      date: { S: date }
    }
  };
}

function getCommentsFromParam(body) {
  console.log(JSON.parse(body), "BODY");
  return {
    TableName: "comments",
    ExpressionAttributeValues: {
      ":v1": {
        S: JSON.parse(body)["postID"]
      }
    },
    FilterExpression: "postID = :v1"
  };
}

module.exports.send = async event => {
  try {
    const emailParams = generateEmailParams(event.body);
    const data = await ses.sendEmail(emailParams).promise();
    return generateResponse(200, data);
  } catch (err) {
    return generateError(500, err);
  }
};

module.exports.comment = async event => {
  try {
    const commentParams = generateCommentParams(event.body);
    const result = await dynamodb
      .putItem(commentParams)
      .promise()
      .then(res => {
        return {
          statusCode: 200,
          status: "Successful",
          item: aws.DynamoDB.Converter.unmarshall(commentParams.Item)
        };
      });
    return generateResponse(200, result);
  } catch (error) {
    return generateError(500, error);
  }
};

module.exports.getComment = async event => {
  try {
    const slugParams = getCommentsFromParam(event.body);
    const res = await dynamodb
      .scan(slugParams)
      .promise()
      .then(response => {
        return {
          statusCode: 200,
          status: "Successful",
          items: response.Items.map(item =>
            aws.DynamoDB.Converter.unmarshall(item)
          )
        };
      });
    return generateResponse(200, res);
  } catch (error) {
    return generateError(500, error);
  }
};
