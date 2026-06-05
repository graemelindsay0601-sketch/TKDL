/* =========================================================
   TKDL LEGACY TIMELINE ENGINE
========================================================= */

function buildLegacyTimeline(
  playerName
){

  const matches =
    getCareerMatches();

  const timeline = [];

  matches.forEach(row => {

    const timestamp =
      row[0];

    const p1 =
      String(row[1] || "")
        .trim();

    const p2 =
      String(row[2] || "")
        .trim();

    const winner =
      String(row[3] || "")
        .trim();

    const stake =
      Number(row[4] || 0);

    if(
      p1 !== playerName
      &&
      p2 !== playerName
    ){
      return;
    }

    const opponent =

      p1 === playerName
        ? p2
        : p1;

    const won =
      winner === playerName;

    /* =========================
       FIRST WIN
    ========================= */

    if(
      won
      &&
      !timeline.some(
        e => e.type === "FIRST_WIN"
      )
    ){

      timeline.push({

        type:"FIRST_WIN",

        title:
          "First Victory",

        description:
          `Defeated ${opponent}`,

        timestamp

      });

    }

    /* =========================
       HIGH ROLLER
    ========================= */

    if(stake >= 25){

      timeline.push({

        type:"HIGH_ROLLER",

        title:
          "High Roller",

        description:
          `${stake} point wager vs ${opponent}`,

        timestamp

      });

    }

    /* =========================
       ELIMINATION
    ========================= */

    if(
      won
      &&
      stake >= 10
    ){

      timeline.push({

        type:"EXECUTION",

        title:
          "Execution Match",

        description:
          `Defeated ${opponent} in a high stakes clash`,

        timestamp

      });

    }

    /* =========================
       UPSET
    ========================= */

    if(
      won
      &&
      stake >= 15
    ){

      timeline.push({

        type:"UPSET",

        title:
          "Major Upset",

        description:
          `Took down ${opponent} in a massive wager`,

        timestamp

      });

    }

  });

  timeline.sort((a,b) => {

    return new Date(b.timestamp)
      -
      new Date(a.timestamp);

  });

  return timeline;

}