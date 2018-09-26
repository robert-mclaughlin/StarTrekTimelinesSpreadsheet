import '../assets/css/semantic.min.css';

import React from 'react';

import STTApi from 'sttapi';
import { CONFIG, getChronitonCount } from 'sttapi';

import { openDevTools } from '../utils/pal';

export class CaptainCard extends React.Component {
	render() {
		if (!STTApi.loggedIn) {
			return <span/>;
		}

		return (<div className="ui inverted segment">
			<div className="ui two column grid">
			<div className="row">
				<div className="column four wide center aligned">
					<img className="ui image small" src={this.props.captainAvatarBodyUrl} />
				</div>
				<div className="column twelve wide">
					<div className="ui raised inverted segment">
						<div className="ui black medium label">
							DBID {STTApi.playerData.dbid}
						</div>
						<div className="ui black medium label">
							Location {STTApi.playerData.character.navmap.places.find((place) => { return place.symbol == STTApi.playerData.character.location.place; }).display_name}
						</div>

						<div className="ui black large image label">
							<img src={CONFIG.SPRITES['energy_icon'].url} className="ui" />
							{getChronitonCount()}
						</div>

						<div className="ui black large image label">
							<img src={CONFIG.SPRITES['images_currency_pp_currency_0'].url} className="ui" />
							{STTApi.playerData.premium_purchasable}
						</div>

						<div className="ui black large image label">
							<img src={CONFIG.SPRITES['images_currency_pe_currency_0'].url} className="ui" />
							{STTApi.playerData.premium_earnable}
						</div>

						<div className="ui black large image label">
							<img src={CONFIG.SPRITES['images_currency_honor_currency_0'].url} className="ui" />
							{STTApi.playerData.honor}
						</div>

						<div className="ui black large image label">
							<img src={CONFIG.SPRITES['images_currency_sc_currency_0'].url} className="ui" />
							{STTApi.playerData.money}
						</div>

						<div className="ui black large image label">
							<img src={CONFIG.SPRITES['cadet_icon'].url} className="ui" />
							{STTApi.playerData.character.cadet_tickets.current} / {STTApi.playerData.character.cadet_tickets.max}
						</div>

						<div className="ui black large image label">
							<img src={CONFIG.SPRITES['sb_hull_repair'].url} className="ui" />
							{STTApi.playerData.replicator_limit - STTApi.playerData.replicator_uses_today} / {STTApi.playerData.replicator_limit}
						</div>
					</div>
					<button className="ui primary button" onClick={() => this.props.onLogout()}><i className="icon sign out"></i>Logout</button>
					<button className="ui primary button" onClick={() => this.props.onRefresh()}><i className="icon refresh"></i>Refresh</button>
					<button className="ui icon button" onClick={() => openDevTools()}><i className="icon bug"></i></button>
				</div>
			</div>
		</div>
		<br />
		</div>);
	}
}