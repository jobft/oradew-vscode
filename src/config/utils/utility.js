import { sep, parse, resolve, relative } from "path";
import { readFileSync, outputJsonSync } from "fs-extra";
const stripJson = require("strip-json-comments");
const exec = require("child_process").exec;

let utils = {};

let mapDirToObjectType = {
  PACKAGES: "PACKAGE",
  PROCEDURES: "PROCEDURE",
  FUNCTIONS: "FUNCTION",
  PACKAGE_BODIES: "PACKAGE BODY",
  VIEWS: "VIEW",
  TRIGGERS: "TRIGGER",
  TYPES: "TYPE",
  TYPE_BODIES: "TYPE BODY",
  TABLES: "TABLE"
};

let mapObjectTypeAlternative = {
  PACKAGE: "PACKAGE_SPEC",
  "PACKAGE BODY": "PACKAGE_BODY",
  TYPE: "TYPE_SPEC",
  "TYPE BODY": "TYPE_BODY"
};

// Simple invert object function
// Avoid importing _lodash
const invert = obj => val => {
  for (let key in obj) {
    if (obj[key] === val) return key;
  }
};

utils.getDirTypes = () => Object.keys(mapDirToObjectType);
utils.getObjectTypes = () => Object.values(mapDirToObjectType);
utils.getObjectTypeFromDir = dir => mapDirToObjectType[dir] || dir;
utils.getObjectType1FromObjectType = type =>
  mapObjectTypeAlternative[type] || type;
utils.getDirFromObjectType = type => invert(mapDirToObjectType)(type) || type;

utils.getDBObjectFromPath = path => {
  // Path can be relative or absolute
  // tasks ${file} is absolute for ex
  const absPath = resolve(path);
  const base = resolve("./");
  const relPath = relative(base, absPath);
  const pathSplit = relPath.split(sep);

  let owner, objectName, dir, objectType, objectType1;
  // Object name is always from file name
  objectName = parse(absPath).name;

  let isScript, isSource;
  // Glob matching is too costy...
  isScript = pathSplit[0].toLowerCase() === "scripts";
  isSource = pathSplit[0].toLowerCase() === "src";

  // console.log("path=" + path);
  // console.log("pathSplit=" + pathSplit);
  // console.log("isscript=" + isScript);
  // console.log("issource=" + isSource);

  // We determine owner from path in Source and Scripts folder
  // Null otherwise
  if (isScript) {
    // `./${scripts}/${owner}/${name}.sql`,
    // Owner is important
    // unfortunately is on different position than in Source
    owner = pathSplit[1];
    dir = "SCRIPTS"; //non existent type but no problem
  } else if (isSource) {
    // `./${source}/${owner}/${dir}/${name}.sql`,
    // owner = pathSplit[1];
    // dir = pathSplit[2];
    // More resilient if we go backwards
    owner = pathSplit[pathSplit.length - 3];
    dir = pathSplit[pathSplit.length - 2];
  } else {
    // `./${deploy}/${name}.sql`,
    // No owner here
    // will go for default when looking for conn conf
    owner = null;
    // dir = pathSplit[0];
    dir = "FILE";
  }

  objectType = utils.getObjectTypeFromDir(dir);
  objectType1 = utils.getObjectType1FromObjectType(objectType);

  // console.log("owner=" + owner);
  // console.log("objectName=" + objectName);
  // console.log("objectType=" + objectType);

  return {
    owner,
    objectName,
    objectType,
    objectType1,
    isScript,
    isSource
  };
};

class Config {
  constructor(file) {
    this.file = file || "./oradewrc.json";
    this.object = null;
    // @TODO error handling when ther is no config file
    // this.load();
  }

  load() {
    this.object = JSON.parse(stripJson(readFileSync(this.file, "utf8")));
  }
  save() {
    return outputJsonSync(this.file, this.object);
  }
  get(field) {
    if (!this.object) this.load();
    return field ? this.object[field] : this.object;
  }
  set(field, value) {
    this.object[field] = value;
  }
}

export const getDBObjectFromPath = utils.getDBObjectFromPath;
export const getObjectTypeFromDir = utils.getObjectTypeFromDir;
export const getDirFromObjectType = utils.getDirFromObjectType;
export const getObjectTypes = utils.getObjectTypes;
export const getDirTypes = utils.getDirTypes;
export const config = new Config();

export function execPromise(cmd) {
  return new Promise(function(resolve, reject) {
    exec(cmd, (error, stdout) => {
      if (error) {
        reject(error);
      }
      resolve(stdout);
    });
  });
}
