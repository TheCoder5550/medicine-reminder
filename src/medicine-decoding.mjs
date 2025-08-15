export function decodeMedicineData(matrixString) {
  const pc = extractPC(matrixString);
  const sn = extractSN(matrixString);
  const lot = extractLOT(matrixString);
  const exp = extractEXP(matrixString);

  return {
    PC: pc,
    SN: sn,
    LOT: lot,
    EXP: exp
  };
}

function extractPC(matrixString) {
  const gs = String.fromCharCode(29);
  const regex = new RegExp(`${gs}01(.{14})`);
  const match = matrixString.match(regex);
  if (!match) {
    return null;
  }

  return match[1];
}

function extractSN(matrixString) {
  const regex = new RegExp(`21(.{14})`);
  const match = matrixString.match(regex);
  if (!match) {
    return null;
  }

  return match[1];
}

function extractLOT(matrixString) {
  const regex = new RegExp(`3010(.{6})`);
  const match = matrixString.match(regex);
  if (!match) {
    return null;
  }

  return match[1];
}

function extractEXP(matrixString) {
  const gs = String.fromCharCode(29);
  const regex = new RegExp(`${gs}17(\\d{2})(\\d{2})`);
  const match = matrixString.match(regex);
  if (!match) {
    return null;
  }

  const year = match[1];
  const month = match[2];

  return { month, year };
}