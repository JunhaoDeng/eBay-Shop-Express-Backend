const express = require("express");
const axios = require("axios");
const app = express();
const btoa = require("btoa");
const cors = require("cors");
var Mongoclient = require("mongodb").MongoClient;
const multer = require("multer");

class OAuthToken {
  constructor(client_id, client_secret) {
    this.client_id = client_id;
    this.client_secret = client_secret;
  }

  getBase64Encoding() {
    const credentials = `${this.client_id}:${this.client_secret}`;
    const base64String = btoa(credentials);
    return base64String;
  }

  async getApplicationToken() {
    const url = "https://api.ebay.com/identity/v1/oauth2/token";

    const headers = {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${this.getBase64Encoding()}`,
    };

    const data = new URLSearchParams();
    data.append("grant_type", "client_credentials");
    data.append("scope", "https://api.ebay.com/oauth/api_scope");

    try {
      const response = await axios.post(url, data, { headers });
      return response.data.access_token;
    } catch (error) {
      console.error("Error obtaining access token:", error);
      throw error;
    }
  }
}

const port = 8080;

const API_Key = "JunhaoDe-AndrewEB-PRD-492d3cfae-fb57cd3e";
const API_Secret = "PRD-92d3cfae414a-29b3-4d01-9e3f-3610";
const Google_API_Key = "AIzaSyBlfvYO_OauuKqKdfJKLT2pCYAW0oUFUIc";
const Search_Engine_ID = "72e9cb85b8eb74394";

const oauthToken = new OAuthToken(API_Key, API_Secret);

app.use(function (req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});
app.use(cors());
var CONNECTION_STRING =
  "mongodb+srv://junhaodeng111:Wj781005882485@cluster0.gpigjvj.mongodb.net/?retryWrites=true&w=majority";

async function make_API_call(url) {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    throw error;
  }
}

async function make_API_call_with_header(url, headers = {}) {
  try {
    const response = await axios.get(url, { headers: headers });
    return response.data;
  } catch (error) {
    throw error; // or handle the error as you prefer
  }
}

app.get("/getAPIResponse", async (req, res) => {
  const url = `http://api.geonames.org/postalCodeSearchJSON?postalcode_startsWith=${req.query.curr}&username=andrewdd&country=US&maxRows=5`;
  try {
    const response = await make_API_call(url);
    res.json(response);
  } catch (error) {
    res.send(error);
  }
});

app.get("/getProductSearchResult", async (req, res) => {
  let itemFilters = [];
  let j = 0;

  let conditionFilters = [];

  console.log(typeof req.query["new"]);
  console.log(req.query["new"]);
  if (
    req.query["unspecified"] == "false" ||
    !req.query["unspecified"] ||
    req.query["unspecified"] === null
  ) {
    ["new", "used"].forEach((condition) => {
      if (req.query[condition] == "true") {
        console.log(condition + " is true");
        conditionFilters.push(
          condition.charAt(0).toUpperCase() + condition.slice(1)
        );
      }
    });
  }

  if (conditionFilters.length) {
    itemFilters.push(
      `itemFilter(${j}).name=Condition&` +
        conditionFilters
          .map(
            (condition, idx) => `itemFilter(${j}).value(${idx})=${condition}`
          )
          .join("&")
    );
    j++;
  }

  if (req.query["free"] == "true") {
    console.log("free: " + req.query["free"] + "");
    itemFilters.push(
      `itemFilter(${j}).name=FreeShippingOnly&itemFilter(${j}).value=true`
    );
    j++;
  }

  if (req.query["local"] == "true") {
    console.log("local: " + req.query["local"] + "");
    itemFilters.push(
      `itemFilter(${j}).name=LocalPickupOnly&itemFilter(${j}).value=true`
    );
    j++;
  }

  // if (req.query["category"] && req.query["category"] != "-1") {
  //   console.log("category: " + req.query["category"] + "");
  //   itemFilters.push(
  //     `itemFilter(${j}).name=categoryID&itemFilter(${j}).value=${req.query["category"]}`
  //   );
  //   j++;
  // }

  if (req.query["buyerPostalCode"]) {
    itemFilters.push(
      `itemFilter(${j}).name=MaxDistance&itemFilter(${j}).value=${req.query["distance"]}&buyerPostalCode=${req.query["buyerPostalCode"]}`
    );
  }

  let categoryParameter = "";
  if (req.query["category"] && req.query["category"] != "-1") {
    categoryParameter = `&categoryId=${req.query["category"]}`;
  }

  const ebayUrl = `https://svcs.ebay.com/services/search/FindingService/v1?SECURITY-APPNAME=${API_Key}&OPERATION-NAME=findItemsAdvanced&SERVICE-VERSION=1.0.0&RESPONSE-DATA-FORMAT=JSON&RESTPAYLOAD&paginationInput.entriesPerPage=50&keywords=${encodeURIComponent(
    req.query.keyword
  )}${categoryParameter}&${itemFilters.join(
    "&"
  )}&outputSelector(0)=SellerInfo&outputSelector(1)=StoreInfo`;

  console.log(ebayUrl);

  try {
    const response = await make_API_call(ebayUrl);

    const findItemsAdvancedResponse = response.findItemsAdvancedResponse;
    const items = findItemsAdvancedResponse[0]?.searchResult?.[0]?.item || [];
    const total_results =
      findItemsAdvancedResponse[0]?.paginationOutput?.[0]?.totalEntries?.[0] ||
      0;

    // console.log("total_results", total_results);

    const keysToCheck = new Set([
      "galleryURL",
      "title",
      "viewItemURL",
      "returnsAccepted",
      "primaryCategory",
      "condition",
      "topRatedListing",
      "sellingStatus",
      "shippingInfo",
      "sellerInfo",
      "storeInfo",
      "location",
      "postalCode",
    ]);

    const responseItems = [];

    for (const item_data of items) {
      if (responseItems.length == 50) {
        break;
      }

      if (![...keysToCheck].every((key) => item_data.hasOwnProperty(key))) {
        continue;
      }

      const itemToAdd = {
        itemId: item_data.itemId[0],
        galleryURL: item_data.galleryURL[0],
        title: item_data.title[0],
        viewItemURL: item_data.viewItemURL[0],
        returnsAccepted: item_data.returnsAccepted[0],
        categoryName: item_data.primaryCategory[0].categoryName[0],
        condition: item_data.condition[0].conditionDisplayName[0],
        topRatedListing: item_data.topRatedListing[0],
        currentPrice:
          item_data.sellingStatus[0].convertedCurrentPrice[0]["__value__"],
        shippingServiceCost:
          item_data.shippingInfo[0]?.shippingServiceCost?.[0]?.["__value__"],
        expeditedShipping: item_data.shippingInfo[0].expeditedShipping[0],
        shippingInfo: item_data.shippingInfo[0],
        sellerInfo: item_data.sellerInfo[0],
        storeInfo: item_data.storeInfo[0],
        location: item_data.location[0],
        postalCode: item_data.postalCode[0],
      };

      responseItems.push(itemToAdd);
    }
    // console.log("responseItems", responseItems);
    res.json(responseItems);
  } catch (error) {
    res.status(500).send(error);
  }
});

app.get("/getProductDetails", async (req, res) => {
  const url = `https://open.api.ebay.com/shopping?callname=GetSingleItem&responseencoding=JSON&appid=${API_Key}&siteid=0&version=967&ItemID=${req.query.id}&IncludeSelector=Description,Details,ItemSpecifics`;

  let accessToken;
  try {
    accessToken = await oauthToken.getApplicationToken();
    console.log("Access Token:", accessToken);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send(error);
    return;
  }

  const headers = {
    "X-EBAY-API-IAF-TOKEN": accessToken,
  };

  try {
    const response = await make_API_call_with_header(url, headers);
    console.log("Response:", response);
    const item = response.Item || {};
    const extractedData = {};

    const addData = (key, value) => {
      if (value) extractedData[key] = value;
    };

    addData("Photo", item.PictureURL);
    addData("eBay Link", item.ViewItemURLForNaturalSearch);
    addData("Title", item.Title);
    addData("Subtitle", item.Subtitle);

    const price = item.CurrentPrice && item.CurrentPrice.Value;
    const currency = item.CurrentPrice && item.CurrentPrice.CurrencyID;
    if (price && currency) {
      extractedData["Price"] = "$" + `${price} `;
    }

    const location = item.Location;
    const postalCode = item.PostalCode;
    addData("Location", location);
    addData("Seller", item.Seller && item.Seller.UserID);

    const returnAccepted =
      item.ReturnPolicy && item.ReturnPolicy.ReturnsAccepted;
    const returnWithin = item.ReturnPolicy && item.ReturnPolicy.ReturnsWithin;
    const returnPolicy =
      returnAccepted && returnWithin
        ? `${returnAccepted} within ${returnWithin}`
        : returnAccepted;
    addData("Return Policy(US)", returnPolicy);
    addData("Return Policy", item.ReturnPolicy);

    const itemSpecificsData = item.ItemSpecifics || {};
    extractedData["ItemSpecifics"] = itemSpecificsData;

    res.json(extractedData);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send(error);
  }
});

app.get("/getProductPhotos", async (req, res) => {
  const url = `https://www.googleapis.com/customsearch/v1?q=${req.query.title}&cx=${Search_Engine_ID}&imgSize=huge&imgType=photo&num=8&searchType=image&key=${Google_API_Key}`;
  try {
    const response = await make_API_call(url);
    res.json(response);
  } catch (error) {
    res.send(error);
  }
});

app.get("/getSimilarItems", async (req, res) => {
  const url = `https://svcs.ebay.com/MerchandisingService?OPERATION-NAME=getSimilarItems&SERVICE-NAME=MerchandisingService&SERVICE-VERSION=1.1.0&CONSUMER-ID=${API_Key}&RESPONSE-DATA-FORMAT=JSON&REST-PAYLOAD&itemId=${req.query.id}&maxResults=20`;
  try {
    const response = await make_API_call(url);
    res.json(response);
  } catch (error) {
    res.send(error);
  }
});

var DATABASENAME = "HW3";
var database;
var COLLECTIONNAME = "favorites";
app.listen(5038, async () => {
  try {
    const client = await Mongoclient.connect(CONNECTION_STRING);
    database = client.db(DATABASENAME);
    console.log("Mongo DB Connection Successful");
  } catch (error) {
    console.error("An error occurred connecting to MongoDB:", error);
  }
});

app.get("/mongodb/getWishList", (request, response) => {
  database
    .collection(COLLECTIONNAME)
    .find({})
    .toArray((error, result) => {
      if (error) {
        response.status(500).send(error);
      } else {
        response.send(result);
      }
    });
});

app.get("/mongodb/addWishList", (request, response) => {
  const wishListItem = request.query;

  const itemId = wishListItem.itemId;

  database
    .collection(COLLECTIONNAME)
    .findOne({ itemId: itemId }, (error, item) => {
      if (error) {
        response
          .status(500)
          .json({ error: "Error checking for existing item" });
      } else if (item) {
        response
          .status(409)
          .json({ message: "Item with this ID already exists" });
      } else {
        database
          .collection(COLLECTIONNAME)
          .insertOne(wishListItem, (error, result) => {
            if (error) {
              response.status(500).json({ error: "Error inserting item" });
            } else {
              response.status(201).json(result);
            }
          });
      }
    });
});

app.get("/mongodb/addWishList2", (request, response) => {
  const wishListItem = request.query;

  const productId = wishListItem.productId;

  database
    .collection(COLLECTIONNAME)
    .findOne({ productId: productId }, (error, item) => {
      if (error) {
        response
          .status(500)
          .json({ error: "Error checking for existing item" });
      } else if (item) {
        response
          .status(409)
          .json({ message: "Item with this ID already exists" });
      } else {
        database
          .collection(COLLECTIONNAME)
          .insertOne(wishListItem, (error, result) => {
            if (error) {
              response.status(500).json({ error: "Error inserting item" });
            } else {
              response.status(201).json(result);
            }
          });
      }
    });
});

app.get("/mongodb/deleteWishList/:identifier", (request, response) => {
  const identifier = request.params.identifier;
  database
    .collection(COLLECTIONNAME)
    .deleteOne(
      { $or: [{ itemId: identifier }, { productId: identifier }] },
      (error, result) => {
        if (error) {
          response.status(500).json({ error: error.message });
        } else if (result.deletedCount === 0) {
          response
            .status(404)
            .json({ message: "No wish list item found with the given ID." });
        } else {
          response.status(200).json({
            message: `Successfully deleted wish list item with identifier ${identifier}`,
          });
        }
      }
    );
});

app.get("/mongodb/searchWishList/:itemId", (request, response) => {
  const itemId = request.params.itemId;
  database
    .collection(COLLECTIONNAME)
    .findOne({ itemId: itemId }, (error, item) => {
      if (error) {
        response.status(500).json({ error: error.message });
      } else {
        response.status(200).json({ isPresent: !!item });
      }
    });
});

app.get("/mongodb/searchWishList2/:productId", (request, response) => {
  const productId = request.params.productId;
  database
    .collection(COLLECTIONNAME)
    .findOne({ productId: productId }, (error, item) => {
      if (error) {
        response.status(500).json({ error: error.message });
      } else {
        response.status(200).json({ isPresent: !!item });
      }
    });
});

app.listen(port, () => console.log(`App listening on port ${port}!`));
