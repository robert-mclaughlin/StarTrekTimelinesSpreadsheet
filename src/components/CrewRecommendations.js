import React from 'react';

import { CrewList } from './CrewList.js';
import { CollapsibleSection } from './CollapsibleSection.js';

import STTApi from 'sttapi';

export class CrewRecommendations extends React.Component {
	constructor(props) {
		super(props);

		if (!STTApi.minimalComplement) {
			// The thread (worker) didn't finish loading yet
			this.state = {
				dataLoaded: false
			};
		}
		else {
			this.state = {
				dataLoaded: true,
				removableCrew: STTApi.roster.filter((crew) => STTApi.minimalComplement.unneededCrew.includes(crew.id) && (crew.frozen === 0)),
				unfreezeCrew: STTApi.roster.filter((crew) => STTApi.minimalComplement.neededCrew.includes(crew.id) && (crew.frozen > 0))
			};
		}
	}

	render() {
		if (this.state.dataLoaded) {
			return <div className='tab-panel' data-is-scrollable='true'>
				<h2>Minimal crew complement needed for cadet challenges <span style={{color:'red'}}> OUTDATED</span></h2>
				<p><b>Note:</b> These recommendations do not take into account the needs for gauntlets, shuttle adventures, voyages or any ship battle missions. They also don't account for quest paths, only considering the needs of individual nodes. Manually review each one before making decisions.</p>

				<h3>Crew which could be frozen or airlocked</h3>
				<CrewList data={this.state.removableCrew} embedded={true} />
				<h3>Crew which needs to be unfrozen</h3>
				<CrewList data={this.state.unfreezeCrew} embedded={true} />
			</div>;
		}
		else {
			return <p>Minimal crew calculation not done yet. Reload this page in a bit.</p>
		}
	}
}