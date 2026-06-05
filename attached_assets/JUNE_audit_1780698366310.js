function auditJuneStats() {

  const ss =
    SpreadsheetApp.openById(
      "1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc"
    );

  const players =
    ss.getSheetByName("PLAYERS")
      .getDataRange()
      .getValues();

  players.slice(1).forEach(row => {

    const name = row[0];

    const games =
      Number(row[4]) || 0;

    const wins =
      Number(row[5]) || 0;

    const losses =
      Number(row[6]) || 0;

    if(games !== wins + losses){

      Logger.log(
        "BROKEN: " +
        name +
        " | G:" + games +
        " W:" + wins +
        " L:" + losses
      );

    }

  });

}

function auditStatuses(){

  const ss =
    SpreadsheetApp.openById(
      "1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc"
    );

  const data =
    ss.getSheetByName("PLAYERS")
      .getDataRange()
      .getValues();

  data.slice(1).forEach(row => {

    Logger.log(
      row[0] +
      " | " +
      row[1] +
      " | " +
      row[3]
    );

  });

}

function proveRebuildRunning(){

  const ss =
    SpreadsheetApp.openById(
      "1XMiRxT7W_OMmnaplaAKzdTWQngepIQFCfI3qJ1oVbwc"
    );

  const sheet =
    ss.getSheetByName("PLAYERS");

  const data =
    sheet.getDataRange().getValues();

  for(let i=1;i<data.length;i++){

    if(
      String(data[i][0]).trim() ===
      "Sean"
    ){

      data[i][3] = 1234;

      break;

    }

  }

  sheet
    .getRange(
      1,
      1,
      data.length,
      data[0].length
    )
    .setValues(data);

  Logger.log(
    "SEAN SET TO 1234"
  );

}