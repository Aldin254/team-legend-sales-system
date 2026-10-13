
const fs = require("fs");
const path = require("path");

const file = path.join(
  process.cwd(),
  "app",
  "dashboard",
  "Cashier24HourReport.js"
);

if (!fs.existsSync(file)) {
  throw new Error(
    "Original Cashier24HourReport.js not found. " +
    "Restore the original file before applying colours."
  );
}

const original = fs.readFileSync(file, "utf8");
const newline = original.includes("\r\n") ? "\r\n" : "\n";
const lines = original.split(/\r?\n/);

// Exact line numbers from your uploaded original file.
// Only colour literals will be replaced.
const changes = [
  [1644, "#10332e"],
  [1645, "#38202a"],
  [1650, "#8ce3c4"],
  [1651, "#ffc2cb"],
  [1820, "#52667a"],
  [1821, "#247b93"],
  [1978, "#0d1926"],
  [2042, "#0d1926"],
  [2105, "#52667a"],
  [2106, "#9d4359"],
  [2342, "#f0f5fa"],
  [2346, "#163846"],
  [2405, "#101f30"],
  [2408, "#101f30"],
  [2409, "#101f30"],
  [2418, "#f0f5fa"],
  [2456, "#152639"],
  [2457, "#152639"],
  [2466, "#f0f5fa"],
  [2626, "#0d1926"],
  [2648, "#15283b"],
  [2651, "#15283b"],
  [2654, "#15283b"],
  [2655, "#15283b"],
  [2664, "#f0f5fa"],
  [2927, "#08121e"],
  [2949, "#0d1b2b"],
  [2952, "#f0f5fa"],
  [3023, "#f0f5fa"],
  [3048, "#0b1827"],
  [3081, "#15263a"],
  [3084, "#f0f5fa"],
  [3158, "#101e2d"],
  [3161, "#8ce3c4"],
  [3164, "#2a6354"],
  [3169, "#38202a"],
  [3172, "#ffc2cb"],
  [3175, "#774155"],
  [3180, "#10332e"],
  [3183, "#8ce3c4"],
  [3186, "#2a6354"],
  [3224, "#101f30"],
  [3244, "#0a1725"],
  [3278, "#223448"],
  [3295, "#52667a"],
  [3309, "#2a6354"],
  [3312, "#10332e"],
  [3326, "#223448"],
  [3329, "#0d1926"],
  [3332, "#91a5b8"],
  [3346, "#40c9ac"],
  [3354, "#d9b66c"],
  [3371, "#152f30"],
  [3382, "#0a1725"],
  [3385, "#91a5b8"],
  [3388, "#223448"],
  [3408, "#38202a"],
  [3411, "#ffc2cb"],
  [3414, "#223448"],
  [3442, "#247b93"],
  [3445, "#f0f5fa"],
  [3461, "#9d4359"],
  [3475, "#0a1725"],
  [3512, "#223448"],
  [3523, "#2a6354"],
  [3526, "#10332e"],
  [3543, "#9d4359"],
  [3546, "#f0f5fa"],
  [3624, "#101f30"],
  [3627, "#f0f5fa"],
  [3653, "#101f30"],
  [3665, "#223448"],
  [3670, "#0d1b2b"],
  [3673, "#f0f5fa"],
  [3693, "#c4d0dc"],
];

if (lines.length < 3694) {
  throw new Error(
    "Unexpected file length. Restore the original 24-hour report."
  );
}

const colourPattern = /#[0-9a-fA-F]{3,8}\b|"white"/;

for (const [lineNumber] of changes) {
  if (!colourPattern.test(lines[lineNumber - 1])) {
    throw new Error(
      `Colour check failed at line ${lineNumber}. ` +
      "No changes were written."
    );
  }
}

for (const [lineNumber, newColour] of changes) {
  lines[lineNumber - 1] = lines[lineNumber - 1].replace(
    colourPattern,
    `"${newColour}"`
  ).replace(/""(#(?:[0-9a-fA-F]{6}))""/, '"$1"');
}

// Correct nested string literals, such as
// border: "1px solid #223448".
const nestedLines = new Map([
  [3164, "#2a6354"],
  [3175, "#774155"],
  [3186, "#2a6354"],
  [3278, "#223448"],
  [3295, "#52667a"],
  [3309, "#2a6354"],
  [3326, "#223448"],
  [3388, "#223448"],
  [3414, "#223448"],
  [3512, "#223448"],
  [3523, "#2a6354"],
  [3665, "#223448"],
]);

for (const [lineNumber, colour] of nestedLines) {
  const line = lines[lineNumber - 1];
  lines[lineNumber - 1] = line.replace(
    /"1px solid "#[0-9a-fA-F]{6}""/,
    `"1px solid ${colour}"`
  );
}

const backup = file + ".backup";
if (!fs.existsSync(backup)) {
  fs.writeFileSync(backup, original);
}

fs.writeFileSync(file, lines.join(newline));

console.log(
  "24-hour cashier colours updated successfully."
);
console.log(
  "Original backed up as Cashier24HourReport.js.backup"
);
console.log(
  "No imports, financial logic or layout code changed."
);
