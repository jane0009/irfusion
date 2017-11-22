const electron = require("electron")
const squirrelUrl = "http://localhost:3333";
const path = require("path")
const url = require("url")
const app = electron.app
const Menu = electron.Menu;
const Tray = electron.Tray;
const BrowserWindow = electron.BrowserWindow

const {
    default: installExtension,
    REACT_DEVELOPER_TOOLS
} = require("electron-devtools-installer");

const startAutoUpdater = (squirrelUrl) => {
    // The Squirrel application will watch the provided URL
    electron.autoUpdater.setFeedURL(`${squirrelUrl}/win64/`);

    // Display a success message on successful update
    electron.autoUpdater.addListener("update-downloaded", (event, releaseNotes, releaseName) => {
        electron.dialog.showMessageBox({
            "message": `The release ${releaseName} has been downloaded`
        });
    });

    // Display an error message on update error
    electron.autoUpdater.addListener("error", (error) => {
        electron.dialog.showMessageBox({
            "message": "Auto updater error: " + error
        });
    });

    // tell squirrel to check for updates
    electron.autoUpdater.checkForUpdates();
}

const handleSquirrelEvent = () => {
    if (process.argv.length === 1) {
        return false;
    }

    const squirrelEvent = process.argv[1];
    switch (squirrelEvent) {
        case '--squirrel-install':
        case '--squirrel-updated':
        case '--squirrel-uninstall':
            setTimeout(app.quit, 1000);
            return true;

        case '--squirrel-obsolete':
            app.quit();
            return true;
    }
}

if (handleSquirrelEvent()) {
    // squirrel event handled and app will exit in 1000ms, so don't do anything else
    return;
}

const config = require("./config.json")

let win = null;

let area
let w, h

//area = electron.screen.workArea;
function createWindow() {
    w = area && area.width ? area.width : 800;
    h = area && area.height ? area.height : 600
    win = new BrowserWindow({
        width: w,
        height: h,
        icon: "./icon.ico"
    })
    win.loadURL(url.format({
        pathname: path.join(__dirname, "index.html"),
        protocol: "file:",
        slashes: true
    }))

    //win.webContents.openDevTools()

    win.on("closed", () => {
        win = null;
    })

    win.webContents.once("did-finish-load", () => {})
}




let tray = null;
app.on("ready", () => {
    if (process.env.NODE_ENV !== "dev") startAutoUpdater(squirrelUrl)

    area = electron.screen.workArea;

    createWindow();
    //
    tray= new Tray("./icon.ico")
    const context = Menu.buildFromTemplate(
        [
            {label:'Quit IrfusIon',type:'normal', role: 'quit'}
        ]
    )
    tray.setToolTip("IrfusIon")
    tray.setContextMenu(context)
    //
    installExtension(REACT_DEVELOPER_TOOLS)
        .then((name) => console.log(`Added Extension:  ${name}`))
        .catch((err) => console.log("An error occurred: ", err));
})
app.on("window-all-closed", () => {
    tray.destroy();
    if (process.platform !== "darwin") {
        app.quit()
    }
})
app.on("activate", () => {
    if (win === null) {
        area = electron.screen.workArea;

        createWindow()
    }
})

process.on('error', (e) => {
    console.warn("ERROR: " + e);
})