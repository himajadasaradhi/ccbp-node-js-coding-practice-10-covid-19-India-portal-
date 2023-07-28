const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

let db = null;
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server is running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

let authorizeToken = (request, response, next) => {
  let authHeader = request.headers["authorization"];
  let jwtToken;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, "MY_ACCESS_TOKEN", (error, payLoad) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
};

//login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const checkUserQuery = `SELECT * FROM user WHERE username='${username}'`;
  const dbUser = await db.get(checkUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const passwordCheck = await bcrypt.compare(password, dbUser.password);
    if (passwordCheck === true) {
      const payLoad = { username: username };
      const jwtToken = jwt.sign(payLoad, "MY_ACCESS_TOKEN");
      response.status(200);
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const convertCase = (dbObject) => {
  return {
    stateName: dbObject.state_name,
    stateId: dbObject.state_id,
    population: dbObject.population,
  };
};
const convertDistrictCase = (dbObject) => {
  return {
    districtName: dbObject.district_name,
    districtId: dbObject.district_id,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};
//API 2
app.get("/states/", authorizeToken, async (request, response) => {
  const allStatesQuery = `SELECT * FROM state`;
  const allStates = await db.all(allStatesQuery);
  response.send(allStates.map((eachState) => convertCase(eachState)));
});

//API 3
app.get("/states/:stateId/", authorizeToken, async (request, response) => {
  const { stateId } = request.params;
  const stateQuery = `SELECT * FROM state WHERE state_id=${stateId}`;
  const state = await db.get(stateQuery);
  response.send(convertCase(state));
});

//API 4
app.post("/districts/", authorizeToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const createDistrictQuery = `INSERT INTO district(district_name,state_id,cases,
        cured,active,deaths) VALUES('${districtName}','${stateId}','${cases}',
        '${cured}','${active}','${deaths}')`;
  const district = await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

//API 5
app.get("/districts/:districtId", authorizeToken, async (request, response) => {
  const { districtId } = request.params;
  const districtQuery = `SELECT * FROM district WHERE district_id=${districtId}`;
  const district = await db.get(districtQuery);
  response.send(district);
});

//API 6
app.delete(
  "/districts/:districtId/",
  authorizeToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `DELETE FROM district WHERE district_id=${districtId}`;
    await db.run(deleteQuery);
    response.send("District Removed");
  }
);

//API 7
app.put(
  "/districts/:districtId/",
  authorizeToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const updateDistrictQuery = `UPDATE district SET district_name='${districtName}',
    state_id='${stateId}',cases='${cases}',cured='${cured}',active='${active}',
    deaths='${deaths}'`;
    const updatedDistrict = await db.get(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//API 8
app.get(
  "/states/:stateId/stats/",
  authorizeToken,
  async (request, response) => {
    const { stateId } = request.params;
    const statsQuery = `SELECT SUM(cases) AS totalCases,SUM(cured) AS totalCured,
    SUM(active) AS totalActive, SUM(deaths) AS totalDeaths FROM district WHERE 
    state_id=${stateId}`;
    const stats = await db.get(statsQuery);
    response.send(stats);
  }
);

module.exports = app;
