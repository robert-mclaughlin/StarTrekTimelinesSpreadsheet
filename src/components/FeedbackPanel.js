import React from 'react';
import { Callout } from 'office-ui-fabric-react/lib/Callout';
import { PrimaryButton } from 'office-ui-fabric-react/lib/Button';
import { Icon } from 'office-ui-fabric-react/lib/Icon';

import { createIssue } from '../utils/githubUtils';

const electron = require('electron');
const shell = electron.shell;

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
		createIssue(isFeedback);
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
					<PrimaryButton text='Buy me a coffee' onClick={() => shell.openExternal("https://www.buymeacoffee.com/Evbkf8yRT")} iconProps={{ iconName: 'CoffeeScript' }} />
					<br/>
					<a href='mailto:crewmanifest@gmail.com'><Icon iconName='Mail' /> <span>crewmanifest@gmail.com</span></a>
				</div>
			</Callout>);
	}
}
