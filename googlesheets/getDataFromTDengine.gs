function getDataFromTDengine(query, url, token, db) {
  
  // This function expects the query, url, token and db to be supplied
  
  // Hardcoded query for testing
  var query = "select _wstart,twa(pm25),twa(pm10),twa(temperature),station from weather.pollution partition by station interval (12w)";

  var TDENGINE_CLOUD_TOKEN = token;

  // hardcoded token for testing
  var TDENGINE_CLOUD_TOKEN="029d8a34264c09ef8bf519732d514ae3e69bf47b";
  
  var TDENGINE_CLOUD_URL= url;
  // hardcoded url for testing
  var TDENGINE_CLOUD_URL="https://gw.us-west-1.gcp.cloud.tdengine.com";

  var restEndPoint = "/rest/sql/"

  // hardcoded db name for testing
  var db = "weather"

  // Construct the final URL for the request
  var finalURL = TDENGINE_CLOUD_URL+ restEndPoint + db + "?token="+TDENGINE_CLOUD_TOKEN
  
  //Logger.log(finalURL)

  // POST request with the query in payload
  var options = {
    'method' : 'post',
    'contentType' : 'application/x-www-form-urlencoded',
    'payload' : query
  };

  // construct the request
  const req = UrlFetchApp.getRequest(finalURL,options);
  Logger.log(req)

  // make the request
  let response = UrlFetchApp.fetch(finalURL,options);
  var tderesp;
  
  // Make sure response is OK
  if (response.getResponseCode() == 200) { // if HTTP-status is 200-299
    // get the response body (the method explained below)
    tderesp =  response.getContentText();
  } 
  else {
    Logger.log("HTTP-Error: " + response.getResponseCode());
  }
  
  // Get the active spreadsheet
  const activeSheet = SpreadsheetApp.getActiveSpreadsheet();
  
  // choose the tab - we use the default tab which is always named "Sheet1"
  const sheet = activeSheet.getSheetByName("Sheet1");

  // TDengine returns JSON with the keys - code, column_meta and data if everything went well
  // Otherwise it returns code and desc
  const result = JSON.parse(tderesp);

  // Check for code == 0 (success) otherwise log error
  if (result.code == 0) {
    
    // get the row headers from the column_meta key
    for (let x=0; x < result.column_meta.length; x++) {
      var label = result.column_meta[x][0];
      sheet.getRange(1,x+1).setValue(label);
    }
    // get the data values and populate them starting at row 2
    for (let i=0; i < result.data.length; i++) {
  
      const row = result.data[i];
      for (let j=0; j < result.data[i].length; j++) {
        sheet.getRange(i+2, j+1).setValue(row[j]);
      }

    }
  }
  else {
    Logger.log("TDengine returned code: " + result.code)
    Logger.log("Description: " + result.desc)
  }
}
