import React, { Component } from 'react';
import { Callout } from 'office-ui-fabric-react/lib/Callout';
import { PrimaryButton } from 'office-ui-fabric-react/lib/Button';

import STTApi from 'sttapi';

const os = require('os');
const electron = require('electron');
const app = electron.app || electron.remote.app;
const shell = electron.shell;

const bugBody = `
**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:

**Expected behavior**
A clear and concise description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Additional context**
Add any other context about the problem here.`;

const featureBody = `
**Is your feature request related to a problem? Please describe.**
A clear and concise description of what the problem is. Ex. I'm always frustrated when [...]

**Describe the solution you'd like**
A clear and concise description of what you want to happen.

**Describe alternatives you've considered**
A clear and concise description of any alternative solutions or features you've considered.

**Additional context**
Add any other context or screenshots about the feature request here.`;

export class FeedbackPanel extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			showFeedbackPanel: false
		};

		this.show = this.show.bind(this);
		this._sendFeedback = this._sendFeedback.bind(this);
	}

	show() {
		this.setState({ showFeedbackPanel: !this.state.showFeedbackPanel });
	}

	_sendFeedback(isFeedback) {
		let title = 'Bug report';
		let labels = 'bug';
		let body = bugBody;
		if (isFeedback) {
			title = 'Feature request';
			labels = 'enhancement';
			body = featureBody;
		}

		body += `
Tool version: **${app.getVersion()}**
Operating system: **${os.platform()} ${os.arch()} (${os.release()})**
`;

		body = body.replace('\r\n', '\n');

		let url = `https://github.com/IAmPicard/StarTrekTimelinesSpreadsheet/issues/new?labels=${encodeURIComponent(labels)}&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;

		shell.openItem(url);
	}

	render() {
		return (
			<Callout
				role={'alertdialog'}
				gapSpace={1}
				calloutWidth={220}
				target={this.props.targetElement}
				setInitialFocus={true}
				hidden={!this.state.showFeedbackPanel}
				onDismiss={() => this.setState({showFeedbackPanel: false}) }
				>
				<div style={{ padding: '15px', maxWidth: '300px' }}>
					<p>Please submit feedback and bug reports on GitHub</p>
					<PrimaryButton text='Send feedback' onClick={() => this._sendFeedback(true)} iconProps={{ iconName: 'Comment' }} />
					<br/><br/>
					<PrimaryButton text='Report bug' onClick={() => this._sendFeedback(false)} iconProps={{ iconName: 'Bug' }} />
					<br/><br/>
					<PrimaryButton text='Buy me a coffee' onClick={() => shell.openItem("https://www.buymeacoffee.com/Evbkf8yRT")} iconProps={{ iconName: 'CoffeeScript' }} />
					<br/>
				</div>
			</Callout>);
	}
}
