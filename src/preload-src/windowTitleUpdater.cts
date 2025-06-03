/*
Preload script for updating the window title in Electron.
This script listens for when the current Website Title changes and for when the active document type changes, and updates the window title accordingly.
*/

/* ---------- Imports ---------- */

import { ipcRenderer } from "electron";

/* ---------- Preload Script Start Msg ---------- */

console.log("Loading windowTitleUpdater.ts preload script...");

/* ---------- Constants ---------- */
const appName = "Onshape";
// const appName = "Onshape Desktop";
// const titleSeparator = " - ";  // Dash
const titleSeparator = " — ";  // Em Dash
// const titleSeparator = " | ";  // Pipe
// const titleSeparator = " : ";  // Colon

/* ---------- Local Variables ---------- */
// (See below Class Definitions for Local Class Variables)

let lastTabElement: Element | null = null;

/* ---------- Class Definitions ---------- */

/* ----- Title Manager ----- */
class TitleManager {

  public fullTitle: string | null = null;

  constructor(
    public baseTitle: string | null,
    public location: Location | null,
  ) {
    this.baseTitle = baseTitle;
    if (this.baseTitle === null) {
      this.baseTitle = window.document.title;
      console.log(`Initialized TitleManager with base title from document.title: ${this.baseTitle}`);
    }

    this.location = location;
    if (this.location === null) {
      this.location = Location.getLocation();
    }

    this.fullTitle = this.toString();
  }

  toString() {
    if (this.baseTitle === null || this.location === null || !this.location.validLocation) {
      console.log(`Base title or location is null. (baseTitle: ${this.baseTitle}, location: ${this.location})`);
      let _baseTitle = this.baseTitle ? this.baseTitle : "Null Base Title";
      let _location = (this.location ? this.location.toString() : "Null Location");
      return `${_baseTitle}${titleSeparator}${_location}${titleSeparator}${appName}`;
    }

    return `${this.baseTitle}${titleSeparator}${this.location}${titleSeparator}${appName}`;
  }
  
  onPossibleTitleChange(currentTitle: string, changeEventReason: string) {
    // console.log(`onPossibleTitleChange triggered by ${changeEventReason}.`);
    let titleUpdated = false;
    if (this.baseTitle === null || this.baseTitle.length === 0) {
      this.baseTitle = window.document.title;
      let reason = this.baseTitle === null ? "null" : "empty";
      console.log(`Base title was ${reason} in onPossibleTitleChange. Setting base title to document.title: ${this.baseTitle}`);
    }

    if (this.fullTitle !== currentTitle && this.baseTitle !== currentTitle) {
      // Title has changed. Update the title.

      console.log("Base Title Changed. Updating Full Title...");
      console.log(`    Old Base: '${this.baseTitle}', New Base: '${currentTitle}'`);
      console.log(`    Old Full: '${this.fullTitle}', New Full: '${this.toString()}'`); 

      this.baseTitle = currentTitle;
      this.fullTitle = this.toString();
      window.document.title = this.fullTitle;
      // return;
      titleUpdated = true;
    }

    let currentLocation: Location = Location.getLocation();
    // if (this.location != currentLocation) {
    if (!this.location?.isEqual(currentLocation)) {
      // Location has changed. Update the title.
      // console.log(`!!! Location Changed. Updating Full Title...`);
      // console.log(`    Old Location: '${this.location}', New Location: '${currentLocation}'`);
      // console.log(`    Old Full: '${this.fullTitle}', New Full: '${this.toString()}'`); 

      this.location = currentLocation;
      // console.log(`Set location to new location. (===: ${this.location === currentLocation})`);
      this.fullTitle = this.toString();
      window.document.title = this.fullTitle;
      // return;
      titleUpdated = true;
    }

    if (titleUpdated) {
      console.log(`onPossibleTitleChange triggered by ${changeEventReason}.`);
      console.log(`    Title updated to: ${this.fullTitle}`);
    }
  }

}

/* ----- Location Classes ----- */


class LocationType {
    // SignIn = "Sign In",
    // Help = "Help",
    // FeatureScriptInto = "FeatureScript Into",
    // Forum = "Forum",
    // SystemCheck = "System Check",
    // LearningCenter = "Learning Center",
    // AppStore = "App Store",

    // DocumentList = "Document List",
    // Workspace = "Workspace",

    // Unknown = "Unknown"

    static SignIn = new LocationType("Sign In", "cad.onshape.com", "\/signin.*");
    static Help = new LocationType("Help", "cad.onshape.com", "\/help.*");
    static FeatureScriptInto = new LocationType("FeatureScript Into", "cad.onshape.com", "\/FsDoc.*");
    static Forum = new LocationType("Forum", "forum.onshape.com");
    static SystemCheck = new LocationType("System Check", "cad.onshape.com", "\/check.*");
    static LearningCenter = new LocationType("Learning Center", "learn.onshape.com");
    static AppStore = new LocationType("App Store", "cad.onshape.com", "\/appstore.*");

    // static DocumentList = new LocationType("Document List", "cad.onshape.com", "\/documents\?.*");
    static DocumentList = new LocationType("Document List", "cad.onshape.com", "\/documents$");
    static Workspace = new LocationType("Workspace", "cad.onshape.com", "\/documents\/.*");

    static Unknown = new LocationType("Unknown Loc Type", null, null);

    /* ----- Properties ----- */

    /* ----- Constructor ----- */
    constructor(public name: string, public host: string | null = null, public pathPattern: string | null = null) {
        this.name = name;
        this.host = host;
        this.pathPattern = pathPattern;
    }

    /* ----- Methods ----- */
    isEqual(other: LocationType | null): boolean {
      return this.name === other?.name && this.host === other?.host && this.pathPattern === other?.pathPattern;
    }

    checkURL(pageHost: string | null, pagePath: string | null): boolean {

        if (this.host !== pageHost){
          // Current host does not match the expected host. Can not possibly be a matching location.
          // console.log(`Host check: ${pageHost} matches ${this.host}: false`);
          return false;
        }

        if (this.pathPattern !== null && pagePath !== null) {
          // We have a path to check. If the paths match, return true.
          const pathMatches = pagePath.match(this.pathPattern) !== null;
          // console.log(`Path check: ${pagePath} matches ${this.pathPattern}: ${pathMatches}`);
          return pathMatches;
        }else if (this.pathPattern !== null && pagePath === null) {
          // We have a path to check, but the page path is null. This is not a match.
          // console.log(`Path check: ${pagePath} matches ${this.pathPattern}: false`);
          return false;
        }
        
        // We are at the correct host, but we don't have a path to check.
        // console.log(`Path check: ${pageHost} matches ${this.host}: ${pageHost === this.host}`);
        return pageHost === this.host;
    }

    static getByHost(host: string | null, path: string | null): LocationType {
        const locationType = Object.values(LocationType).find((locType) => locType.checkURL(host, path));
        return locationType ? locationType : LocationType.Unknown;
    }
}

class DocumentType {

  /* Primary Document Types */
  static Assembly = new DocumentType("Assembly");
  static PartStudio = new DocumentType("Part Studio");
  static FeatureStudio = new DocumentType("Feature Studio", "feature-studio-element");
  static VariableStudio = new DocumentType("Variable Studio", "variable-studio-element");
  static MaterialLibrary = new DocumentType("Material Library", "material-library-element");
  static Drawing = new DocumentType("Drawing");

  // - Unverified, but probably correct -
  static RenderStudio = new DocumentType("Render Studio", "renderstudio-icon");
  static PCBStudio = new DocumentType("PCB Studio", "ecad-icon");
  static CAMStudio = new DocumentType("CAM Studio", "camstudio-icon");

  /* Uploadable Document Types */
  static Image = new DocumentType("Image", "image-element");
  static PDF = new DocumentType("PDF", "pdf-element");
  static SVG = new DocumentType("SVG", "svg-element");

  /* Other Document Types */

  /* Unknown Document Types */
  static Blob = new DocumentType("Blob (Maybe App?)", "blob-element", true);  // This might be for Applications?
  static Folder = new DocumentType("Folder", null, true);
  static Import = new DocumentType("Import", "document-upload", true);


  /* Fallback Document Type */
  static Unknown = new DocumentType("Unknown Doc Type", "unknown-element", true);
   

  constructor(
    public name: string,
    public key: string | null = null,
    public alertOnSight: boolean = false,
  ){
    this.name = name;
    this.key = key ? key : name.toLowerCase().replaceAll(" ", "");
  }

  isEqual(other: DocumentType | null): boolean {
    return this.name === other?.name && this.key === other?.key;
  }

  toString() {
    return this.name;
  }

  // Class Method to get the DocumentType by key
  static getByKey(key: string): DocumentType {
    const documentType = Object.values(DocumentType).find((docType) => docType.key === key);
    return documentType ? documentType : DocumentType.Unknown;
  }

  // Prints an alert if the document type is marked for alerting
  alert(msg: string) {
    if (this.alertOnSight) {
      // console.log(`Alert: ${this.name} detected! ${msg}`);
      console.log(`${this.name} Alert: ${msg}`);
    }
  }
}


class Location {

  constructor(
    public type: LocationType,
    public document: DocumentType | null = null
  ) {
    this.type = type;
    this.document = document;
  }

  /*
  static private getLocationType(): LocationType {
    const document = window.document;
    if (!document) {
      console.log("Document is null or undefined. Returning Unknown location.");
      return LocationType.Unknown;
    }

    if (document.querySelector(".os-document-list-page-container")) {
      console.log("Location: Document List");
      return LocationType.DocumentList;
    }

    // let activeTab = document.querySelectorAll('.os-tab-bar-tab.active');
    let activeTab = document.querySelector('.os-tab-bar-tab.active');
    if (activeTab) {
      let docIconName = activeTab.getAttribute('data-icon-src');
      if (docIconName) {
        let docType = DocumentType.getByKey(docIconName);
        console.log("Location: Workspace", docType);
        return new 
      }
    }
  */


  static getLocation(): Location {
    const document = window.document;
    if (!document) {
      console.log("Document is null or undefined. Returning Unknown location.");
      return new Location(LocationType.Unknown);
    }

    const locationType = LocationType.getByHost(window.location.host, window.location.pathname);


    // if (document.querySelector(".os-document-list-page-container")) {
    //   console.log("Location: Document List");
    //   return new Location(LocationType.DocumentList);
    // }
    console.log(`Determined Location Type: ${locationType.name} (host: ${window.location.host}, pathname: ${window.location.pathname})`); 

    if (locationType !== LocationType.Workspace) {
      // console.log(`Location: ${locationType.name}`);
      return new Location(locationType);
    }

    // let activeTab = document.querySelectorAll('.os-tab-bar-tab.active');
    let activeTab = document.querySelector('.os-tab-bar-tab.active');
    let docIconName = activeTab?.getAttribute('data-icon-src');

    if (docIconName) {
      let docType = DocumentType.getByKey(docIconName);
      console.log("Location: Workspace", docType);
      return new Location(LocationType.Workspace, docType);
    }
  
    console.log(`Unable to determine workspace type. Returning Unknown. ( activeTab: ${activeTab}, docIconName: ${docIconName} )`);
    return new Location(locationType, DocumentType.Unknown);
  }

  isEqual(other: Location): boolean {
    return this.type.isEqual(other.type) && (this.document ? this.document.isEqual(other.document) : other.document === null);
  }

  toString() {
    // return `Location: ${this.type}, Document: ${this.document ? this.document.name : "None"}`;
    if (this.type.isEqual(LocationType.Unknown)) {
      return "?";
    }

    let locationName: string = this.document ? this.document.name : this.type.name;
    return locationName;
  }

  validLocation(): boolean {
    if (this.type.isEqual(LocationType.Unknown)) {
      return false;
    }
    if (this.document !== null && this.document.isEqual(DocumentType.Unknown)) {
      return false;
    }

    return true;
  }

}

/* ---------- Local Class Variables ---------- */
// These need to be declared after the class definitions.
let titleManager: TitleManager = new TitleManager(null, null);


/* ---------- Functions ---------- */


/* ----- Window Title Updater ----- */

async function setupWindowTitleObserver() {

  console.log("Setting up window title observer...");

  // Use a MutationObserver to watch for changes in the document title
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        const newTitle = mutation.target.textContent;
        if (newTitle) {
          titleManager.onPossibleTitleChange(newTitle, "window-title-updated");
          // console.log("New title detected:", newTitle);
        }
      }
    });
  });

  // Select the appropriate target node
  let titleElementTarget = document.querySelector("title");

  // Configure the observer
  let titleObserverConfig = { subtree: true, characterData: true, childList: true };

  // Start observing the target node for configured mutations
  if (titleElementTarget) {
      observer.observe(titleElementTarget, titleObserverConfig);
  }else {
      console.log("Critical Error! Title element not found. Mutation observer not started.");
  }
}

async function setupTabChangeObserver() {
  // Use a MutationObserver to watch for changes in the document title
  const observer = new MutationObserver((mutations, obs) => {
    let activeTabElement = document.querySelector('.os-tab-bar-tab.active');
    if (activeTabElement && activeTabElement !== lastTabElement) {
      //TODO: I don't think `activeTabElement !== lastTabElement` is a valid check.

      lastTabElement = activeTabElement;

      console.log("Tab change observer triggered.", activeTabElement);
      // let docIconName = activeTabElement.getAttribute('data-icon-src');
      // console.log("Active tab icon name:", docIconName);
      titleManager.onPossibleTitleChange(window.document.title, "onshape-active-tab-changed");
    }
  });

  // Configure the observer
  let activeTabObserverConfig = { subtree: true, characterData: true, childList: true };

  // Start observing the target node for configured mutations

  observer.observe(document.body, activeTabObserverConfig);
  console.log("Body Tab change observer started.");
}


// Start the observers when the DOM is fully loaded 
window.addEventListener('DOMContentLoaded', () => {
  console.log("DOMContentLoaded event fired. Setting up window title observer...");
  setupWindowTitleObserver();
  setupTabChangeObserver();
});

