import '../assets/css/semantic.min.css';

import React from 'react';
import { PrimaryButton } from 'office-ui-fabric-react/lib/Button';
import { TextField } from 'office-ui-fabric-react/lib/TextField';
import { Spinner, SpinnerSize } from 'office-ui-fabric-react/lib/Spinner';
import { MessageBar, MessageBarType } from 'office-ui-fabric-react/lib/MessageBar';

import STTApi from 'sttapi';

export class WebLoginDialog extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			hideDialog: !props.shownByDefault,
			errorMessage: null,
			autoLogin: true,
			showSpinner: false,
			username: '',
			password: ''
		};

		this._closeDialog = this._closeDialog.bind(this);
	}

	componentWillReceiveProps(nextProps) {
		if (nextProps.shownByDefault !== this.props.shownByDefault) {
			this.setState({ hideDialog: !nextProps.shownByDefault });
		}
	}

	render() {
		if (this.state.hideDialog) {
			return <span />;
		}

		return (
			<div style={{ color: 'white'}}>
				<div className="ui vertical stripe segment">
					<div className="ui text container">
						<h1 className="ui dividing header inverted">IAmPicard's Star Trek Timelines tools</h1>
						<p>Companion tools for the <a href="https://www.disruptorbeam.com/games/star-trek-timelines/" target='_blank'>Star Trek Timelines</a> game</p>

						<h3 className="ui header inverted"><span className='blinking_thing'>NEW!</span> Online version of the tool <span style={{color:'red'}}>- BETA</span></h3>
						<div className="ui grid">
							<div className="sixteen wide column">
								<p>Login below using your Start Trek Timelines username and password. If you're using Facebook / Steam or a mobile platform and have yet to set up your account, please see instructions <a href='https://startrektimelines.zendesk.com/hc/en-us/articles/215687778-How-do-I-register-my-Star-Trek-Timelines-account-' target='_blank'>here</a>.</p>
								<small>Please read the <a href='https://github.com/IAmPicard/StarTrekTimelinesSpreadsheet#privacy-and-security' target='_blank'>privacy policy</a> before continuing.</small>
								{this.state.errorMessage && (
									<MessageBar messageBarType={MessageBarType.error} isMultiline={false}>
										<span>{this.state.errorMessage}</span>
									</MessageBar>
								)}
							</div>
							<div className="eight wide column">
								<TextField
									label='Username (e-mail)'
									value={this.state.username}
									onChanged={(value) => { this.setState({ username: value }) }}
								/>
							</div>
							<div className="eight wide column">
								<TextField
									label='Password'
									value={this.state.password}
									type='password'
									onChanged={(value) => { this.setState({ password: value }) }}
								/>
							</div>
							<div className="sixteen wide column">
								<PrimaryButton onClick={this._closeDialog} text='Login' disabled={this.state.showSpinner} />
								{this.state.showSpinner && (
									<Spinner size={SpinnerSize.small} label='Logging in...' />
								)}
							</div>
						</div>

						<div className="ui divider"></div>

						<h3 className="ui header inverted">Crew management desktop application</h3>
						<div className="ui grid">
							<div className="eight wide column">
								<a href='https://github.com/IAmPicard/StarTrekTimelinesSpreadsheet' target='_blank'>
									<img className="ui large image" src='https://github.com/IAmPicard/StarTrekTimelinesSpreadsheet/raw/master/docs/Screenshot-Tool.png' />
								</a>
							</div>
							<div className="eight wide column">
								<p>Windows desktop application to help with crew management.</p>
								<p>You can sort, filter, group and export your crew roster. The tool also offers recommendations about crew based on which missions and cadet challenges you're yet to complete.</p>
								<p>You can also get recommendations and chance calculations for gauntlets, and get basic information about ships and equipment.</p>
							</div>
							<div className="sixteen wide column">
								<PrimaryButton onClick={() => {window.open('https://github.com/IAmPicard/StarTrekTimelinesSpreadsheet/releases', '_blank');}} text='Download latest release' />
							</div>
						</div>

						<div className="ui divider"></div>

						<h3 className="ui header inverted">Google Sheets add-on for the crew spreadsheet</h3>
						<div className="ui grid">
							<div className="eight wide column">
								<a href='https://github.com/IAmPicard/STTGoogleSheetsAddon' target='_blank'>
									<img className="ui large image" src='https://raw.githubusercontent.com/IAmPicard/STTGoogleSheetsAddon/master/GoogleSheetsAddon.png' />
								</a>
							</div>
							<div className="eight wide column">
								<p>A very simple add-on for Google Sheets that lets you load your crew stats directly from the game. From a Google Spreadsheet, click on Get Addons and search for "Star Trek Timelines Crew Spreadsheet". Once loaded, you can click on "Start" from the AddOns menu.</p>
								<p>Why would you use this over the other wonderful spreadsheets out there?</p>
								<ul>
									<li>No manual entry and upkeep</li>
									<li>This doesn't assume FFFE or bust (it loads stats for your crew, including starbase bonuses, regardless of their level, stars or equipment slots)</li>
								</ul>
							</div>
							<div className="sixteen wide column">
								<PrimaryButton onClick={() => {window.open('https://chrome.google.com/webstore/detail/star-trek-timelines-crew/fhbgadamglhhcelbmidkmkoepekgkocl?utm_source=permalink', '_blank');}} text='Install here' />
							</div>
						</div>

						<div className="ui divider"></div>

						<a className="bmc-button" target="_blank" href="https://www.buymeacoffee.com/Evbkf8yRT"><img src="https://www.buymeacoffee.com/assets/img/BMC-btn-logo.svg" alt="Buy me a coffee" /><span style={{marginLeft:'5px'}}>Buy me a coffee</span></a>

						<h3 className="ui header inverted">Miscellaneous links</h3>
						<div className="ui list">
							<div className="item">
								<i className="linkify icon"></i>
								<div className="content">
									<a href="https://www.disruptorbeam.com/games/star-trek-timelines/" target='_blank'>Official game page</a>
								</div>
							</div>
							<div className="item">
								<i className="linkify icon"></i>
								<div className="content">
									<a href="https://forums.disruptorbeam.com/stt" target='_blank'>Official game forums</a>
								</div>
							</div>
							<div className="item">
								<i className="linkify icon"></i>
								<div className="content">
									<a href="https://stt.wiki/wiki/Main_Page" target='_blank'>Wiki (player contributed, lots of useful info)</a>
								</div>
							</div>
							<div className="item">
								<i className="linkify icon"></i>
								<div className="content">
									<a href="https://discord.gg/8Du7ZtJ" target='_blank'>Discord channel</a>
								</div>
							</div>
							<div className="item">
								<i className="linkify icon"></i>
								<div className="content">
									<a href="https://www.reddit.com/r/StarTrekTimelines/" target='_blank'>Subreddit</a>
								</div>
							</div>
						</div>
						<br />
						<p>If you want to get in touch with me please open an issue on <a href='https://github.com/IAmPicard/StarTrekTimelinesSpreadsheet/issues' target='_blank'>GitHub</a>, use the feedback dialog in the tool itself or email me at <a href='mailto:info@iampicard.com'>info@iampicard.com</a>.</p>
						<div className="ui small basic label"><b>DISCLAIMER</b> This tool is provided "as is", without warranty of any kind. Use at your own risk! It should be understood that Star Trek Timelines content and materials are trademarks and copyrights of <a href='https://www.disruptorbeam.com/tos/' target='_blank'>Disruptor Beam, Inc.</a> or its licensors. All rights reserved. This tool is neither endorsed by nor affiliated with Disruptor Beam, Inc..</div>
					</div>
				</div>
			</div >
		);
	}

	_closeDialog() {
		this.setState({ showSpinner: true, errorMessage: null });

		let promiseLogin = STTApi.login(this.state.username, this.state.password, this.state.autoLogin);

		promiseLogin.then(() => {
			this.setState({ showSpinner: false, hideDialog: true });
			this.props.onAccessToken();
		})
		.catch((error) => {
			console.error(error);
			this.setState({ showSpinner: false, hideDialog: false, errorMessage: error.message });
		});
	}
}