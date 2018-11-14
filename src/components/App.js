/*
    StarTrekTimelinesSpreadsheet - A tool to help with crew management in Star Trek Timelines
    Copyright (C) 2017-2018 IAmPicard

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
import '../assets/css/App.css';
import React from 'react';

// #!if ENV === 'electron'
import { FileImageCache } from '../utils/fileImageCache.js';
// #!else
import { ServerImageProvider } from '../utils/serverImageCache.js';
import { SiteHome } from './site/SiteHome';
// #!endif

import { AppHome } from './AppHome';

import STTApi from 'sttapi';

class App extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			preBoot: true,
			anonymousUser: false
		};

		// #!if ENV === 'electron' || ENV === 'exp'
		STTApi.setWebMode(false);
		// #!elseif ENV === 'webtest'
		STTApi.setWebMode(true, true);
		// #!else
		STTApi.setWebMode(true);
		// #!endif

		// #!if ENV === 'electron'
		STTApi.setImageProvider(true, new FileImageCache());
		// #!else
		STTApi.setImageProviderOverride(new ServerImageProvider(STTApi.serverAddress));
		// #!endif

		STTApi.loginWithCachedAccessToken().then((success) => {
			this.setState({ preBoot: false, anonymousUser: !success });
		});
	}

	render() {
		if (this.state.preBoot) {
			return <span />;
		}

		// #!if ENV === 'web' || ENV === 'webtest'
		if (this.state.anonymousUser) {
			return <SiteHome onAccessToken={() => this.setState({ anonymousUser: false })} />;
		}
		// #!endif

		return <AppHome onLogout={() => this.setState({ anonymousUser: true })} />;
	}
}

export default App;
