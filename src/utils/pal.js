// #!if ENV === 'electron'
const electron = require('electron');
const app = electron.app || electron.remote.app;
const shell = electron.shell || electron.remote.shell;
const dialog = electron.dialog || electron.remote.dialog;
const fs = require('fs');
const os = require('os');

import { ipcRenderer } from 'electron';
// #!endif

export function getAppVersion() {
// #!if ENV === 'electron'
    return app.getVersion();
// #!else
    return process.env.APP_VERSION + '-web';
// #!endif
}

// #!if ENV === 'electron'
export function getAppPath(name) {
    return app.getPath(name);
}
// #!endif

export function getOSDetails() {
// #!if ENV === 'electron'
    return `${os.platform()} ${os.arch()} (${os.release()})`;
// #!else
    return navigator.userAgent;
// #!endif
}

export function openDevTools() {
// #!if ENV === 'electron'
    ipcRenderer.send("open-dev-tools", "");
// #!else
    alert('Open the developer tools by pressing F12');
// #!endif
}

export function openShellExternal(url) {
// #!if ENV === 'electron'
    shell.openExternal(url);
// #!else
    window.open(url, '_blank');
// #!endif
}

export function download(filename, text, title, buttonLabel) {
    // For the browser:
    /*var pom = document.createElement('a');
    pom.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(text));
    pom.setAttribute('download', filename);

    if (document.createEvent) {
        var event = document.createEvent('MouseEvents');
        event.initEvent('click', true, true);
        pom.dispatchEvent(event);
    }
    else {
        pom.click();
    }*/

    // For Electron:

// #!if ENV === 'electron'
    let extension = filename.split('.').pop();
    let extName = '';
    if (extension === 'csv') {
        extName = 'Comma separated file (*.csv)';
    } else if (extension === 'xlsx') {
        extName = 'Excel spreadsheet (*.xlsx)';
    } else if (extension === 'json') {
        extName = 'JSON formatted file (*.json)';
    } else if (extension === 'html') {
        extName = 'HTML file (*.html)';
    }

    dialog.showSaveDialog(
        {
            filters: [{ name: extName, extensions: [extension] }],
            title: title,
            defaultPath: filename,
            buttonLabel: buttonLabel
        },
        (fileName) => {
            if (fileName === undefined)
                return;

            fs.writeFile(fileName, text, (err) => {
                if (!err) {
                    shell.openItem(fileName);
                }
            });

        });
// #!else

// #!endif
}