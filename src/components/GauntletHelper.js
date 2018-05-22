import React, { Component } from 'react';
import { Label } from 'office-ui-fabric-react/lib/Label';
import { Image, ImageFit } from 'office-ui-fabric-react/lib/Image';
import { MessageBar, MessageBarType } from 'office-ui-fabric-react/lib/MessageBar';
import { SpinButton } from 'office-ui-fabric-react/lib/SpinButton';
import { Checkbox } from 'office-ui-fabric-react/lib/Checkbox';
import { PrimaryButton } from 'office-ui-fabric-react/lib/Button';
import { Persona, PersonaSize, PersonaPresence } from 'office-ui-fabric-react/lib/Persona';
import { DefaultButton, IButtonProps } from 'office-ui-fabric-react/lib/Button';
import { Icon } from 'office-ui-fabric-react/lib/Icon';

import { CrewList } from './CrewList.js';

import STTApi from 'sttapi';
import { CONFIG, loadGauntlet, gauntletCrewSelection, gauntletRoundOdds, payToGetNewOpponents, playContest, enterGauntlet, formatCrewStats } from 'sttapi';

class GauntletCrew extends React.Component {
	render() {
		return (<table className='table-GauntletCrew'>
			<tbody>
				<tr>
					<td>
						<b>{STTApi.getCrewAvatarBySymbol(this.props.crew.archetype_symbol).name}</b>
					</td>
				</tr>
				<tr>
					<td className={this.props.crew.disabled ? 'image-disabled' : ''}>
						<Image src={this.props.crew.iconUrl} height={200} style={{ display: 'inline-block' }} />
					</td>
				</tr>
				<tr>
					<td>
						{this.props.crew.disabled ?
							(<span>Disabled <Icon iconName='Dislike' /> ({this.props.crew.debuff / 4} battles)</span>) :
							(<span>Active <Icon iconName='Like' /> ({this.props.crew.debuff / 4} battles)</span>)
						}
					</td>
				</tr>
				<tr>
					<td>
						{this.props.crew.skills.map(function (skill) {
							return <span className='gauntletCrew-statline' key={skill.skill}>
								<Image src={CONFIG.SPRITES['icon_' + skill.skill].url} height={18} /> {CONFIG.SKILLS[skill.skill]} ({skill.min} - {skill.max})
							</span>;
						})}
						<span className='gauntletCrew-statline'>Crit chance {this.props.crew.crit_chance}%</span>
					</td>
				</tr>
			</tbody>
		</table>);
	}
}

class GauntletMatch extends React.Component {
	constructor(props) {
		super(props);

		this._playMatch = this._playMatch.bind(this);
	}

	_playMatch() {
		playContest(this.props.gauntletId, this.props.match.crewOdd.crew_id, this.props.match.opponent.player_id, this.props.match.opponent.crew_id).
			then((data) => this.props.onNewData(data));
	}

	render() {
		return (<table className='table-GauntletMatch'>
			<tbody>
				<tr>
					<td className='gauntlet-match-crew-slot'>
						<b>{STTApi.getCrewAvatarBySymbol(this.props.match.crewOdd.archetype_symbol).name}</b><br />
						<Image src={this.props.match.crewOdd.iconUrl} height={128} style={{ display: 'inline-block' }} /><br />
						Yours
					</td>
					<td>
						<div className='gauntlet-arrow'>
							<span><b>{this.props.match.chance}%</b> chance</span><br />
							<span><b>{this.props.match.opponent.value}</b> points</span>
						</div>
						<PrimaryButton onClick={this._playMatch} text='Play this match!' iconProps={{ iconName: 'LightningBolt' }} />
					</td>
					<td className='gauntlet-match-crew-slot'>
						<b>{STTApi.getCrewAvatarBySymbol(this.props.match.opponent.archetype_symbol).name}</b><br />
						<Image src={this.props.match.opponent.iconUrl} height={128} style={{ display: 'inline-block' }} />
						{this.props.match.opponent.name}
					</td>
				</tr>
			</tbody>
		</table>);
	}
}

export class GauntletHelper extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			gauntlet: null,
			lastResult: null,
			rewards: null,
			merits: null,
			// Recommendation calculation settings
			featuredSkillBonus: 10,
			critBonusDivider: 3,
			includeFrozen: false,
			calculating: false
		};

		this._reloadGauntletData = this._reloadGauntletData.bind(this);
		this._gauntletDataRecieved = this._gauntletDataRecieved.bind(this);
		this._payForNewOpponents = this._payForNewOpponents.bind(this);
		this._calculateSelection = this._calculateSelection.bind(this);
		this._startGauntlet = this._startGauntlet.bind(this);
		this._reloadGauntletData();
	}

	_reloadGauntletData() {
		loadGauntlet().then((data) => this._gauntletDataRecieved({ gauntlet: data }));
	}

	_payForNewOpponents() {
		payToGetNewOpponents(this.state.gauntlet.id).then((data) => this._gauntletDataRecieved(data));
	}

	_gauntletDataRecieved(data) {
		if (data.gauntlet) {
			if (data.gauntlet.state == 'NONE') {
				this.setState({
					gauntlet: data.gauntlet,
					lastResult: null,
					startsIn: Math.floor(data.gauntlet.seconds_to_join / 60),
					featuredSkill: data.gauntlet.contest_data.featured_skill,
					traits: data.gauntlet.contest_data.traits.map(function (trait) { return STTApi.getTraitName(trait); }.bind(this))
				});
			}
			else if (data.gauntlet.state == 'STARTED') {
				var result = gauntletRoundOdds(data.gauntlet);
				this.setState({
					gauntlet: data.gauntlet,
					roundOdds: result
				});

				let iconPromises = [];

				data.gauntlet.contest_data.selected_crew.forEach((crew) => {
					iconPromises.push(
						STTApi.imageProvider.getCrewImageUrl(STTApi.getCrewAvatarBySymbol(crew.archetype_symbol), true, crew.crew_id).then(({ id, url }) => {
							this.state.gauntlet.contest_data.selected_crew.forEach((crew) => {
								if (crew.crew_id === id) {
									crew.iconUrl = url;
								}
							});
							return Promise.resolve();
						}).catch((error) => { /*console.warn(error);*/ }));
				});

				result.matches.forEach((match) => {
					iconPromises.push(
						STTApi.imageProvider.getCrewImageUrl(STTApi.getCrewAvatarBySymbol(match.crewOdd.archetype_symbol), true, match.crewOdd.crew_id).then(({ id, url }) => {
							this.state.roundOdds.matches.forEach((match) => {
								if (match.crewOdd.crew_id === id) {
									match.crewOdd.iconUrl = url;
								}
							});
							return Promise.resolve();
						}).catch((error) => { /*console.warn(error);*/ }));

					iconPromises.push(
						STTApi.imageProvider.getCrewImageUrl(STTApi.getCrewAvatarBySymbol(match.opponent.archetype_symbol), true, match.opponent.crew_id).then(({ id, url }) => {
							this.state.roundOdds.matches.forEach((match) => {
								if (match.opponent.crew_id === id) {
									match.opponent.iconUrl = url;
								}
							});
							return Promise.resolve();
						}).catch((error) => { /*console.warn(error);*/ }));
				});

				Promise.all(iconPromises).then(() => this.forceUpdate());
			}
			else {
				this.setState({
					gauntlet: data.gauntlet
				});
			}
		}
		else if (data.gauntlet.state == 'UNSTARTED') {
			// You joined a gauntled and are waiting for opponents
		}
		else if (data.gauntlet.state == 'ENDED_WITH_REWARDS') {
			// The gauntlet ended and you got some rewards
		}

		if (data.lastResult) {
			this.setState({
				lastResult: data.lastResult,
				rewards: data.rewards
			});
		}

		if (data.merits) {
			this.setState({
				merits: data.merits
			});
		} else {
			this.setState({
				merits: STTApi.playerData.premium_earnable
			});
		}
	}

	_calculateSelection() {
		this.setState({calculating: true})
		var result = gauntletCrewSelection(this.state.gauntlet, STTApi.roster, (100 + this.state.featuredSkillBonus) / 100, this.state.critBonusDivider, 5 /*preSortCount*/, this.state.includeFrozen);
		this.setState({crewSelection : result.recommendations, calculating: false});
	}

	_startGauntlet() {
		if (this.state.gauntlet && this.state.gauntlet.gauntlet_id && this.state.crewSelection) {

			let crew_ids = [];
			this.state.crewSelection.forEach(id => {
				let crew = STTApi.roster.find(crew => (crew.crew_id === id));
				if (!crew) {
					console.error(`Crew ${id} not found; are you trying to start a gauntlet with frozen crew?`);
					return;
				}

				crew_ids.push(crew.crew_id);
			});

			console.log(crew_ids);

			if (crew_ids.length === 5) {
				enterGauntlet(this.state.gauntlet.gauntlet_id, crew_ids).then((data) => this._gauntletDataRecieved({ gauntlet: data }));
			}
		}
	}

	renderBestCrew() {
		if (!this.state.crewSelection) {
			return <span/>;
		}

		let crewSpans = [];
		this.state.crewSelection.forEach(id => {
			let crew = STTApi.roster.find(crew => (crew.crew_id === id) || (crew.id === id));

			let crewSpan = <Persona
				key={crew.name}
				imageUrl={crew.iconUrl}
				primaryText={crew.name}
				secondaryText={crew.short_name}
				tertiaryText={formatCrewStats(crew)}
				size={PersonaSize.large}
				presence={(crew.frozen === 0) ? PersonaPresence.online : PersonaPresence.away} />

			crewSpans.push(crewSpan);
		});

		return (<div>
			<h3>Best crew</h3>
			{this.state.calculating && <Spinner size={SpinnerSize.small} label='Still calculating...' />}
			<div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
				{crewSpans}
			</div>
		</div>);
	}

	render() {
		if (this.state.gauntlet && (this.state.gauntlet.state == 'NONE')) {
			return (
				<div>
					<Label>Next gauntlet starts in {this.state.startsIn} minutes.</Label>
					<span className='quest-mastery'>Featured skill: <Image src={CONFIG.SPRITES['icon_' + this.state.featuredSkill].url} height={18} /> {CONFIG.SKILLS[this.state.featuredSkill]}</span>
					<Label>Featured traits: {this.state.traits.join(', ')}</Label>

					 {this.renderBestCrew()}

					<div className="ui grid" style={{maxWidth: '600px'}}>
						<div className="row">
							<div className="column"><h4>Algorithm settings</h4></div>
						</div>

						<div className="two column row">
							<div className="column">
								<SpinButton value={this.state.featuredSkillBonus} label='Featured skill bonus:' min={ 0 } max={ 100 } step={ 1 }
									onIncrement={(value) => { this.setState({ featuredSkillBonus: +value + 1}); }}
									onDecrement={(value) => { this.setState({ featuredSkillBonus: +value - 1}); }}
									onValidate={(value) => {
										if (isNaN(+value)) {
											this.setState({ featuredSkillBonus: 10});
											return 10;
										}

										return +value;
									  }}
								/>
							</div>
							<div className="column">
								The higher this number, the more bias applied towards the featured skill during crew selection
							</div>
						</div>

						<div className="two column row">
							<div className="column">
								<SpinButton value={this.state.critBonusDivider} label='Crit bonus divider:' min={ 0.1 } max={ 100 } step={ 0.1 }
									onIncrement={(value) => { this.setState({ critBonusDivider: +value + 0.1}); }}
									onDecrement={(value) => { this.setState({ critBonusDivider: +value - 0.1}); }}
									onValidate={(value) => {
										if (isNaN(+value)) {
											this.setState({ critBonusDivider: 3});
											return 3;
										}

										return +value;
									  }}
								/>
							</div>
							<div className="column">
								The lower this number, the more bias applied towards crew with higher crit bonus rating during selection
							</div>
						</div>

						<div className="row">
							<div className="column">
								<Checkbox checked={this.state.includeFrozen} label="Include frozen crew"
									onChange={(e, isChecked) => { this.setState({ includeFrozen: isChecked }); }}
								/>
							</div>
						</div>
					</div>

					<br/>

					<PrimaryButton onClick={this._calculateSelection} text='Calculate best crew selection' disabled={this.state.calculating} />
					<span> </span>
           			<PrimaryButton onClick={this._startGauntlet} text='Start gauntlet with recommendations' disabled={!this.state.crewSelection} />
				</div>
			);
		}
		else if (this.state.gauntlet && ((this.state.gauntlet.state == 'STARTED') && this.state.roundOdds)) {
			return (
				<div className='tab-panel' data-is-scrollable='true'>
					<h3>Current gauntlet stats</h3>
					<Label>Crew refeshes in {Math.floor(this.state.gauntlet.seconds_to_next_crew_refresh / 60)} minutes and the gauntlet ends in {Math.floor(this.state.gauntlet.seconds_to_end / 60)} minutes</Label>
					<Label>Your rank is {this.state.roundOdds.rank} and you have {this.state.roundOdds.consecutive_wins} consecutive wins</Label>
					<span><h3>Your crew stats <DefaultButton onClick={this._reloadGauntletData} text='Reload data' iconProps={{ iconName: 'Refresh' }} /></h3></span>
					<div style={{ display: 'flex', width: '95%' }} >
						{this.state.gauntlet.contest_data.selected_crew.map(function (crew) {
							return <GauntletCrew key={crew.crew_id} crew={crew} />;
						})}
					</div>
					<h3>Gauntlet player - BETA</h3>

					{this.state.merits &&
						(<p>Merits left: {this.state.merits}</p>)
					}

					{this.state.lastResult &&
						(<table>
							<tbody>
								<tr>
									<td rowSpan={2}>
										<b> {(this.state.lastResult.win == true) ? 'WIN' : 'LOSE'} </b>
									</td>
									<td>You got {this.state.lastResult.player_rolls.reduce(function (sum, value) { return sum + value; }, 0)}</td>
									<td>{this.state.lastResult.player_rolls[0]} {this.state.lastResult.player_crit_rolls[0] ? '*' : ''}</td>
									<td>{this.state.lastResult.player_rolls[1]} {this.state.lastResult.player_crit_rolls[1] ? '*' : ''}</td>
									<td>{this.state.lastResult.player_rolls[2]} {this.state.lastResult.player_crit_rolls[2] ? '*' : ''}</td>
									<td>{this.state.lastResult.player_rolls[3]} {this.state.lastResult.player_crit_rolls[3] ? '*' : ''}</td>
									<td>{this.state.lastResult.player_rolls[4]} {this.state.lastResult.player_crit_rolls[4] ? '*' : ''}</td>
									<td>{this.state.lastResult.player_rolls[5]} {this.state.lastResult.player_crit_rolls[5] ? '*' : ''}</td>
								</tr>
								<tr>
									<td>They got {this.state.lastResult.opponent_rolls.reduce(function (sum, value) { return sum + value; }, 0)}</td>
									<td>{this.state.lastResult.opponent_rolls[0]} {this.state.lastResult.opponent_crit_rolls[0] ? '*' : ''}</td>
									<td>{this.state.lastResult.opponent_rolls[1]} {this.state.lastResult.opponent_crit_rolls[1] ? '*' : ''}</td>
									<td>{this.state.lastResult.opponent_rolls[2]} {this.state.lastResult.opponent_crit_rolls[2] ? '*' : ''}</td>
									<td>{this.state.lastResult.opponent_rolls[3]} {this.state.lastResult.opponent_crit_rolls[3] ? '*' : ''}</td>
									<td>{this.state.lastResult.opponent_rolls[4]} {this.state.lastResult.opponent_crit_rolls[4] ? '*' : ''}</td>
									<td>{this.state.lastResult.opponent_rolls[5]} {this.state.lastResult.opponent_crit_rolls[5] ? '*' : ''}</td>
								</tr>
							</tbody>
						</table>)
					}

					{this.state.rewards && (
						this.state.rewards.loot.map((loot, index) => {
							return (<span key={index} style={{ color: loot.rarity && CONFIG.RARITIES[loot.rarity].color }}>{loot.quantity} {(loot.rarity == null) ? '' : CONFIG.RARITIES[loot.rarity].name} {loot.full_name}</span>);
						}).reduce((prev, curr) => [prev, ', ', curr])
					)}

					<br/>

					{(this.state.roundOdds.matches.length > 0) &&
						<PrimaryButton onClick={this._payForNewOpponents} text='Pay merits for new opponents' iconProps={{ iconName: 'Money' }} />
					}
					<br />

					{this.state.roundOdds.matches.map(function (match) {
						return <GauntletMatch key={match.crewOdd.archetype_symbol + match.opponent.player_id} match={match} gauntletId={this.state.gauntlet.id} onNewData={this._gauntletDataRecieved} />;
					}.bind(this))}
				</div>
			);
		}
		else {
			return (<MessageBar messageBarType={MessageBarType.error} >Unknown state for this gauntlet! Check the app, perhaps it's waiting to join or already done.</MessageBar>);
		}
	}
}