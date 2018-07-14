/*
    StarTrekTimelinesSpreadsheet - A tool to help with crew management in Star Trek Timelines
    Copyright (C) 2017 IAmPicard

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
import { Fabric } from 'office-ui-fabric-react/lib/Fabric';
import { CommandBar } from 'office-ui-fabric-react/lib/CommandBar';
import { Spinner, SpinnerSize } from 'office-ui-fabric-react/lib/Spinner';
import { Pivot, PivotItem, PivotLinkFormat, PivotLinkSize } from 'office-ui-fabric-react/lib/Pivot';
import { Dialog, DialogType, DialogFooter } from 'office-ui-fabric-react/lib/Dialog';
import { Image } from 'office-ui-fabric-react/lib/Image';
import { Callout } from 'office-ui-fabric-react/lib/Callout';
import { SearchBox } from 'office-ui-fabric-react/lib/SearchBox';
import { IconButton, PrimaryButton, DefaultButton } from 'office-ui-fabric-react/lib/Button';
import { Checkbox } from 'office-ui-fabric-react/lib/Checkbox';
import { TooltipHost, TooltipDelay, DirectionalHint } from 'office-ui-fabric-react/lib/Tooltip';
import { initializeIcons } from 'office-ui-fabric-react/lib/Icons';

import { exportExcel } from '../utils/excelExporter.js';
import { exportCsv } from '../utils/csvExporter.js';
import { exportItemsCsv } from '../utils/csvExporter.js';
import { shareCrew } from '../utils/pastebin.js';
// #!if ENV === 'electron'
import { FileImageCache } from '../utils/fileImageCache.js';
// #!else
import { AzureImageProvider } from '../utils/azureImageCache.js';
// #!endif
import { createIssue } from '../utils/githubUtils';

import { LoginDialog } from './LoginDialog.js';
import { ShipList } from './ShipList.js';
import { ItemList } from './ItemList.js';
import { CrewList } from './CrewList.js';
import { GauntletHelper } from './GauntletHelper.js';
import { MissionExplorer } from './MissionExplorer.js';
import { CrewRecommendations } from './CrewRecommendations.js';
import { AboutAndHelp } from './AboutAndHelp.js';
import { FleetDetails } from './FleetDetails.js';
import { ShareDialog } from './ShareDialog.js';
import { EquipmentDetails } from './EquipmentDetails.js';
import { CaptainCard } from './CaptainCard.js';
import { FeedbackPanel } from './FeedbackPanel.js';
import { ShakingButton } from './ShakingButton.js';
import { VoyageTools } from './VoyageTools.js';

import STTApi from 'sttapi';
import { loginSequence } from 'sttapi';
import { download, openShellExternal, getAppVersion } from '../utils/pal';

import { loadTheme, ColorClassNames } from '@uifabric/styling';

// #!if ENV === 'electron'
import { rcompare } from 'semver';
// #!endif

class App extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			showSpinner: false,
			dataLoaded: false,
			isCaptainCalloutVisible: false,
			showLoginDialog: false,
			captainName: 'Welcome!',
			secondLine: '',
			captainAvatarUrl: '',
			captainAvatarBodyUrl: '',
			spinnerLabel: 'Loading...',
			hideErrorDialog: true,
			hideBootMessage: true,
			showBootMessage: false,
			errorMessage: '',
			updateUrl: undefined,
			theme: undefined,
			cost: undefined,
			darkTheme: false
		};

		this._captainButtonElement = null;
		this._feedbackButtonElement = null;
		this._onAccessToken = this._onAccessToken.bind(this);
		this._onLogout = this._onLogout.bind(this);
		this._onRefresh = this._onRefresh.bind(this);
		this._getCommandItems = this._getCommandItems.bind(this);
		this._getInventoryCommandItems = this._getInventoryCommandItems.bind(this);
		this._onShare = this._onShare.bind(this);
		this._onCaptainClicked = this._onCaptainClicked.bind(this);
		this._onCaptainCalloutDismiss = this._onCaptainCalloutDismiss.bind(this);
		this._onDataFinished = this._onDataFinished.bind(this);
		this._onDataError = this._onDataError.bind(this);
		this._playerResync = this._playerResync.bind(this);
		this._onSwitchTheme = this._onSwitchTheme.bind(this);
		this._onDismissBootMessage = this._onDismissBootMessage.bind(this);

		initializeIcons(/* optional base url */);

// #!if ENV === 'electron'
		STTApi.inWebMode = false;
		STTApi.setImageProvider(true, new FileImageCache());
// #!else
		STTApi.inWebMode = true;
		STTApi.setImageProviderOverride(new AzureImageProvider());
		STTApi.networkHelper.setProxy('https://stttools.azurewebsites.net/api/sttproxy');

		STTApi.networkHelper.get('https://stttools.azurewebsites.net/api/getcost', { thismonth: true}).then((data) => {
			this.setState({ cost: data.cost });
		});
// #!endif

		STTApi.config.where('key').equals('ui.darkTheme').first().then((entry) => {
			this.setState({ darkTheme: entry && entry.value });

			this._onSwitchTheme(true);
		});

		STTApi.loginWithCachedAccessToken().then((success) => {
			if (success) {
				this.setState({ showSpinner: true, showLoginDialog: false });
				this._onAccessToken();
			}
			else {
				this.setState({ showLoginDialog: true });
			}
		});

		this._onSwitchTheme(false);
	}

	_onSwitchTheme(shouldForceUpdate) {
		const darkThemePalette = {
			"themePrimary": "#0078d7",
			"themeLighterAlt": "#00080f",
			"themeLighter": "#001527",
			"themeLight": "#00335d",
			"themeTertiary": "#0058a1",
			"themeSecondary": "#0071cd",
			"themeDarkAlt": "#0086f4",
			"themeDark": "#42aaff",
			"themeDarker": "#5cb6ff",
			"neutralLighterAlt": "#001222",
			"neutralLighter": "#001d36",
			"neutralLight": "#002d55",
			"neutralQuaternaryAlt": "#003868",
			"neutralQuaternary": "#004078",
			"neutralTertiaryAlt": "#0063ba",
			"neutralTertiary": "#dee1e4",
			"neutralSecondary": "#e3e6e8",
			"neutralPrimaryAlt": "#e9ebed",
			"neutralPrimary": "#ced3d7",
			"neutralDark": "#f4f5f6",
			"black": "#f9fafa",
			"white": "#00070d",
			"primaryBackground": "#00070d",
			"primaryText": "#ced3d7",
			"bodyBackground": "#00070d",
			"bodyText": "#ced3d7",
			"disabledBackground": "#001d36",
			"disabledText": "#0063ba"
		};

		const lightThemePalette = {
			"themePrimary": "#0078d7",
			"themeLighterAlt": "#eff6fc",
			"themeLighter": "#deecf9",
			"themeLight": "#c7e0f4",
			"themeTertiary": "#71afe5",
			"themeSecondary": "#2b88d8",
			"themeDarkAlt": "#106ebe",
			"themeDark": "#005a9e",
			"themeDarker": "#004578",
			"neutralLighterAlt": "#f8f8f8",
			"neutralLighter": "#f4f4f4",
			"neutralLight": "#eaeaea",
			"neutralQuaternaryAlt": "#dadada",
			"neutralQuaternary": "#d0d0d0",
			"neutralTertiaryAlt": "#c8c8c8",
			"neutralTertiary": "#a6a6a6",
			"neutralSecondary": "#666666",
			"neutralPrimaryAlt": "#3c3c3c",
			"neutralPrimary": "#333",
			"neutralDark": "#212121",
			"black": "#1c1c1c",
			"white": "#fff",
			"primaryBackground": "#fff",
			"primaryText": "#333",
			"bodyBackground": "#fff",
			"bodyText": "#333",
			"disabledBackground": "#f4f4f4",
			"disabledText": "#c8c8c8"
		};

		let finalTheme;

		// Current theme
		if (this.state.darkTheme) {
			finalTheme = loadTheme({ palette: darkThemePalette });
		} else {
			finalTheme = loadTheme({ palette: lightThemePalette });
		}

		const root = document.querySelector('.App-content');
		if (root) {
			root.style.backgroundColor = finalTheme.semanticColors.bodyBackground;
			root.style.color = finalTheme.semanticColors.bodyText;
		}

		document.body.style.backgroundColor = finalTheme.semanticColors.bodyBackground;
		document.body.style.color = finalTheme.semanticColors.bodyText;

		if (shouldForceUpdate) {
			this.setState({theme: finalTheme});
			STTApi.config.put({ key: 'ui.darkTheme', value: this.state.darkTheme });
			this.forceUpdate();
		} else {
			this.state.theme = finalTheme;
		}
	}

	_onDismissBootMessage() {
		STTApi.config.put({ key: 'ui.showBootMessage' + getAppVersion(), value: this.state.showBootMessage });

		this.setState({ hideBootMessage: true });
	}

	_onCaptainClicked() {
		if (!STTApi.loggedIn) {
			this._onLogout();
			return;
		}

		if (!this.state.showSpinner)
			this.setState({ isCaptainCalloutVisible: !this.state.isCaptainCalloutVisible });
	}

	_onCaptainCalloutDismiss() {
		this.setState({
			isCaptainCalloutVisible: false
		});
	}

	componentDidMount() {
		this.intervalPlayerResync = setInterval(this._playerResync, 5 * 60 * 1000);
	}

	componentWillUnmount() {
		clearInterval(this.intervalPlayerResync);
	}

	_playerResync() {
		// Every 5 minutes, refresh the player currency data (the number of merits, chronitons, etc.)
		if (this.state.dataLoaded) {
			STTApi.resyncPlayerCurrencyData();
		}
	}

	render() {
		return (
			<Fabric style={{ color: this.state.theme.semanticColors.bodyText, backgroundColor: this.state.theme.semanticColors.bodyBackground }} className='App'>
				<div className='lcars'>
					<div className='lcars-corner-left' />
					<div className='lcars-content'>
						<Image src={this.state.captainAvatarUrl} height={25} />
					</div>
					<div className='lcars-ellipse' />
					<div className='lcars-content-text'>
						<span style={{ cursor: 'pointer' }} onClick={this._onCaptainClicked} ref={(menuButton) => this._captainButtonElement = menuButton}>{this.state.captainName}</span>
						{this.state.isCaptainCalloutVisible && (
							<Callout className='CaptainCard-callout'
								role={'alertdialog'}
								gapSpace={0}
								targetElement={this._captainButtonElement}
								onDismiss={this._onCaptainCalloutDismiss}
								setInitialFocus={true}
							>
								<CaptainCard captainAvatarBodyUrl={this.state.captainAvatarBodyUrl} onLogout={this._onLogout} onRefresh={this._onRefresh} />
							</Callout>
						)}
					</div>
					<div className='lcars-ellipse' />
					<div className='lcars-content-text'>
						{this.state.secondLine}
					</div>
					{this.state.updateUrl && <div className='lcars-ellipse' />}
					{this.state.updateUrl && <div className='lcars-content-text' style={{ cursor: 'pointer' }}>
						<a style={{color: 'red'}} onClick={() => openShellExternal(this.state.updateUrl)}>Update available!</a>
					</div>}
					{this.state.cost && <div className='lcars-ellipse' />}
					{this.state.cost && <div className='lcars-content-text' style={{ cursor: 'pointer' }}>
						<TooltipHost calloutProps={{ gapSpace: 20 }} delay={TooltipDelay.zero} directionalHint={DirectionalHint.bottomCenter}
							tooltipProps={{ onRenderContent: () => {
								return ( <div>
									<span>Cost to operate the website this month: ${this.state.cost}</span>
									<br/>
									<span>After evaluation / beta, I'll either shut down the website or introduce a donation system to cover the costs.</span>
								</div> ); }}} >
							<span>Cost: ${this.state.cost}</span>
						</TooltipHost>
					</div>}
					<div className='lcars-box' />
					<div className='lcars-content'>
						<IconButton iconProps={{ iconName: 'Light' }} title='Switch theme' onClick={() => {
							this.setState({darkTheme: !this.state.darkTheme}, () => this._onSwitchTheme(true));
							}} className={ColorClassNames.neutralDark} />
					</div>
					<div className='lcars-ellipse' />
					<div className='lcars-content' ref={(menuButton) => this._feedbackButtonElement = menuButton}>
						<ShakingButton iconName='Emoji2' title='Feedback' interval={20000} onClick={() => this.refs.feedbackPanel.show()} />
					</div>
					<div className='lcars-corner-right' />
				</div>

				<Dialog
					hidden={ this.state.hideErrorDialog }
					onDismiss={ () => { this.setState({ hideErrorDialog: true });} }
					dialogContentProps={ {
						type: DialogType.normal,
						title: 'An error occured while loading data!',
						subText: 'Try restarting the application; if the error persists, please log a bug. Details: ' + this.state.errorMessage
					} }
					modalProps={{ isBlocking: true}}
					>
					<DialogFooter>
						<PrimaryButton onClick={ () => { createIssue(false, this.state.errorMessage); }} text='Create bug report' />
						<DefaultButton onClick={ () => { this.setState({ hideErrorDialog: true });} } text='Cancel' />
					</DialogFooter>
				</Dialog>

				<Dialog
					hidden={ this.state.hideBootMessage }
					onDismiss={ () => { this._onDismissBootMessage(); } }
					dialogContentProps={ {
						type: DialogType.normal,
						title: 'Please read me',
						subText: 'Star Trek Timelines is not designed to be accessed on multiple clients simultaneously!'
					} }
					modalProps={{ isBlocking: true }}
					>
					<div>
						<p>In order to avoid synchronization issues, please only have <b>one active client at a time</b> (this includes the game on any platform and/or the tool). Close / shut down all other clients, or restart them upon making changes somewhere else.</p>
						<p><i>Note:</i>If you're only using the tool to look at stats (and are ok with potentially out of date info), and don't use the Gauntlet or Voyage features, you can keep it running alongside the game.</p>

						<Checkbox checked={!this.state.showBootMessage} label="Don't show again"
							onChange={(e, isChecked) => { this.setState({ showBootMessage: !isChecked }); }}
						/>

						<br/>
					</div>
					<DialogFooter>
						<PrimaryButton onClick={ () => { openShellExternal('https://github.com/IAmPicard/StarTrekTimelinesSpreadsheet/blob/master/README.md'); }} text='Read more...' />
						<DefaultButton onClick={ () => { this._onDismissBootMessage(); } } text='Ok' />
					</DialogFooter>
				</Dialog>

				<FeedbackPanel ref='feedbackPanel' targetElement={this._feedbackButtonElement} />

				{this.state.showSpinner && (
					<Spinner size={SpinnerSize.large} label={this.state.spinnerLabel} />
				)}

				{this.state.dataLoaded && (
					<Pivot linkFormat={PivotLinkFormat.tabs} linkSize={PivotLinkSize.large}>
						<PivotItem linkText='Crew' itemIcon='Teamwork'>
							<CommandBar items={this._getCommandItems()} />
							<SearchBox placeholder='Search by name or trait...'
								onChange={(newValue) => this.refs.crewList.filter(newValue)}
								onSearch={(newValue) => this.refs.crewList.filter(newValue)}
							/>
							<CrewList data={STTApi.roster} grouped={false} ref='crewList' />
						</PivotItem>
						<PivotItem linkText='Items' itemIcon='Boards'>
							<CommandBar items={this._getInventoryCommandItems()} />
							<SearchBox placeholder='Search by name or description...'
								onChange={(newValue) => this.refs.itemList.filter(newValue)}
								onSearch={(newValue) => this.refs.itemList.filter(newValue)}
							/>
							<ItemList data={STTApi.playerData.character.items} ref='itemList' />
						</PivotItem>
						<PivotItem linkText='Equipment' itemIcon='CheckList'>
							<EquipmentDetails />
						</PivotItem>
						<PivotItem linkText='Ships' itemIcon='Airplane'>
							<ShipList />
						</PivotItem>
						<PivotItem linkText='Missions' itemIcon='Trophy'>
							<MissionExplorer />
						</PivotItem>
						<PivotItem linkText='Recommendations' itemIcon='Lightbulb'>
							<CrewRecommendations />
						</PivotItem>
						<PivotItem linkText='Voyage' itemIcon='Rocket'>
							<VoyageTools />
						</PivotItem>
						<PivotItem linkText='Gauntlet' itemIcon='DeveloperTools'>
							<GauntletHelper />
						</PivotItem>
						<PivotItem linkText='Fleet' itemIcon='WindDirection'>
							<FleetDetails />
						</PivotItem>
						<PivotItem linkText='About' itemIcon='Help'>
							<AboutAndHelp />
						</PivotItem>
					</Pivot>
				)}

				<LoginDialog ref='loginDialog' onAccessToken={this._onAccessToken} shownByDefault={this.state.showLoginDialog} />
				<ShareDialog ref='shareDialog' onShare={this._onShare} />
			</Fabric>
		);
	}

	_getCommandItems() {
		return [
			{
				key: 'exportExcel',
				name: 'Export Excel',
				iconProps: { iconName: 'ExcelLogo' },
				onClick: async () => {
					let data = await exportExcel(STTApi.playerData.character.items);
					download('My Crew.xlsx', data, 'Export Star Trek Timelines crew roster', 'Export');
				}
			},
			{
				key: 'exportCsv',
				name: 'Export CSV',
				iconProps: { iconName: 'ExcelDocument' },
				onClick: () => {
					let csv = exportCsv();
					download('My Crew.csv', csv, 'Export Star Trek Timelines crew roster', 'Export');
				}
			},
			{
				key: 'share',
				name: 'Share',
				iconProps: { iconName: 'Share' },
				onClick: () => { this.refs.shareDialog._showDialog(this.state.captainName); }
			},
			{
				key: 'configure',
				name: 'Configure',
				iconProps: { iconName: 'Settings' },
				subMenuProps: {
					items: [
						{
							key: 'grouping',
							name: 'Group options',
							subMenuProps: {
								items: [
									{
										key: 'none',
										name: 'None',
										//canCheck: true,
										//checked: this.refs.crewList ? (this.refs.crewList.getGroupedColumn() == '') : false,
										onClick: () => { this.refs.crewList.setGroupedColumn(''); }
									},
									{
										key: 'rarity',
										name: 'Group by rarity',
										//canCheck: true,
										//checked: this.refs.crewList ? (this.refs.crewList.getGroupedColumn() == 'max_rarity') : false,
										onClick: () => { this.refs.crewList.setGroupedColumn('max_rarity'); }
									}
								]
							}
						}
					]
				}
			}
		];
	}

	_getInventoryCommandItems() {
		return [
			{
				key: 'exportCsv',
				name: 'Export CSV',
				iconProps: { iconName: 'ExcelDocument' },
				onClick: () => {
					let csv = exportItemsCsv();
					download('My Items.csv', csv, 'Export Star Trek Timelines item inventory', 'Export');
				}
			}
		];
	}

	_onShare(options) {
		shareCrew(options);
	}

	_onAccessToken() {
		this.setState({ showSpinner: true });

		loginSequence((progressLabel) => this.setState({ spinnerLabel: progressLabel }))
			.then(this._onDataFinished)
			.catch((err) => {
				this._onDataError(err);
			});
	}

	_onLogout() {
		this.setState({ isCaptainCalloutVisible: false });
		STTApi.refreshEverything(true);
		this.setState({ showLoginDialog: true, dataLoaded: false, captainName: 'Welcome!', spinnerLabel: 'Loading...', secondLine: '' });
		this.refs.loginDialog._showDialog('');
	}

	_onRefresh() {
		this.setState({ isCaptainCalloutVisible: false });
		STTApi.refreshEverything(false);
		this.setState({ dataLoaded: false, spinnerLabel: 'Refreshing...' });
		this._onAccessToken();
	}

	_onDataError(reason) {
		this.setState({ errorMessage: reason, hideErrorDialog: false });
	}

	async _onDataFinished() {
// #!if ENV === 'electron'
		// This resets with every new version, in case the message is updated or folks forget
		let entry = await STTApi.config.where('key').equals('ui.showBootMessage' + getAppVersion()).first();
		let shouldShowBootMessage = !entry || entry.value;
// #!else
		// TODO: This ifdef should be the same on web, but Safari crashes and burns with dexie indexeddb transactions (potentially Promise-related)
		let shouldShowBootMessage = false;
// #!endif
		this.setState({
			showSpinner: false,
			captainName: STTApi.playerData.character.display_name,
			secondLine: 'Level ' + STTApi.playerData.character.level,
			hideBootMessage: !shouldShowBootMessage,
			showBootMessage: shouldShowBootMessage,
			dataLoaded: true
		});

// #!if ENV === 'electron'
		let data = await STTApi.getGithubReleases();
		let versions = data.map((release) => release.tag_name.replace('v', ''));
		let maxVersion = versions.sort(rcompare)[0];

		if (maxVersion != getAppVersion()) {
			var n = new Notification('STT Tool - Update available!', { body: 'A new release of the Star Trek Tool (' + data[0].tag_name + ' ' + data[0].name + ') has been made available. Please check the About tab for download instructions!' });
			this.setState({
				updateUrl: data[0].html_url
			});
		}
// #!endif

		if (STTApi.playerData.character.crew_avatar) {
			STTApi.imageProvider.getCrewImageUrl(STTApi.playerData.character.crew_avatar, false, 0).then(({ id, url }) => {
				this.setState({ captainAvatarUrl: url });
			}).catch((error) => { this.setState({ captainAvatarUrl: '' }); });

			STTApi.imageProvider.getCrewImageUrl(STTApi.playerData.character.crew_avatar, true, 0).then(({ id, url }) => {
				this.setState({ captainAvatarBodyUrl: url });
			}).catch((error) => { this.setState({ captainAvatarBodyUrl: '' }); });
		}

		this.refs.crewList.filter('');
	}
}

export default App;
