import React from 'react';
import { Label } from 'office-ui-fabric-react/lib/Label';
import { Spinner, SpinnerSize } from 'office-ui-fabric-react/lib/Spinner';
import { Image } from 'office-ui-fabric-react/lib/Image';
import { MessageBar, MessageBarType } from 'office-ui-fabric-react/lib/MessageBar';
import { SpinButton } from 'office-ui-fabric-react/lib/SpinButton';
import { Checkbox } from 'office-ui-fabric-react/lib/Checkbox';
import { PrimaryButton } from 'office-ui-fabric-react/lib/Button';
import { Persona, PersonaSize, PersonaPresence } from 'office-ui-fabric-react/lib/Persona';
import { DefaultButton } from 'office-ui-fabric-react/lib/Button';
import { Icon } from 'office-ui-fabric-react/lib/Icon';
import { getTheme } from '@uifabric/styling';

// #!if ENV === 'electron'
import Logger from '../utils/logger';
// #!endif

import { download } from '../utils/pal';

import STTApi from 'sttapi';
import {
	CONFIG, loadGauntlet, gauntletCrewSelection, gauntletRoundOdds, payToGetNewOpponents,
	payToReviveCrew, claimRankRewards, playContest, enterGauntlet, formatCrewStats, formatTimeSeconds
} from 'sttapi';

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
						{this.props.crew.skills.map((skill) =>
							<span className='gauntletCrew-statline' key={skill.skill}>
								<Image src={CONFIG.SPRITES['icon_' + skill.skill].url} height={18} /> {CONFIG.SKILLS[skill.skill]} ({skill.min} - {skill.max})
							</span>
						)}
						<span className='gauntletCrew-statline'>Crit chance {this.props.crew.crit_chance}%</span>
					</td>
				</tr>
				<tr>
					<td>
						{this.props.crew.disabled ?
							<PrimaryButton onClick={() => this.props.revive(true)} text='Revive (30 dil)' iconProps={{ iconName: 'Money' }} /> :
							<PrimaryButton onClick={() => this.props.revive(false)} text='Restore (30 dil)' iconProps={{ iconName: 'Money' }} />}
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
		playContest(this.props.gauntlet.id, this.props.match.crewOdd.crew_id, this.props.match.opponent.player_id, this.props.match.opponent.crew_id, this.props.match).
			then((data) => {
				let logPath = undefined;

				// #!if ENV === 'electron'
				logPath = Logger.logGauntletEntry(data, this.props.match, this.props.consecutive_wins);
				// #!endif

				this.props.onNewData(data, logPath, this.props.match);
			});
	}

	render() {
		//TODO: 320px hardcoded below!
		let containerStyle = {
			padding: '2px',
			backgroundColor: getTheme().palette.themeLighter,
			display: 'grid',
			gridTemplateColumns: '100px auto 12px auto 100px',
			gridTemplateRows: '14px 46px 50px 32px',
			gridTemplateAreas: `
			"pcrewname pcrewname . ocrewname ocrewname"
			"pcrewimage stats stats stats ocrewimage"
			"pcrewimage chance chance chance ocrewimage"
			"pcrewimage button button button ocrewimage"`};

		return <div>
			<div style={containerStyle} className="ui attached segment">
				<span style={{ gridArea: 'pcrewname', justifySelf: 'center' }}>{STTApi.getCrewAvatarBySymbol(this.props.match.crewOdd.archetype_symbol).name}</span>
				<div style={{ gridArea: 'pcrewimage', position: 'relative' }}>
					<Image src={this.props.match.crewOdd.iconUrl} height={128} />
					<div className="ui olive circular label" style={{ position: 'absolute', left: '0', bottom: '0' }}>{this.props.match.crewOdd.crit_chance}%</div>
				</div>

				<div style={{ gridArea: 'stats' }}>
					<table style={{ width: '100%' }}>
						<tbody>
							<tr>
								<td style={{ textAlign: 'center', verticalAlign: 'middle' }}>{this.props.match.crewOdd.min[0]}-{this.props.match.crewOdd.max[0]}</td>
								<td style={{ textAlign: 'center' }}><Image src={CONFIG.SPRITES['icon_' + this.props.gauntlet.contest_data.primary_skill].url} height={18} /></td>
								<td style={{ textAlign: 'center', verticalAlign: 'middle' }}>{this.props.match.opponent.min[0]}-{this.props.match.opponent.max[0]}</td>
							</tr>
							<tr>
								<td style={{ textAlign: 'center', verticalAlign: 'middle' }}>{this.props.match.crewOdd.min[1]}-{this.props.match.crewOdd.max[1]}</td>
								<td style={{ textAlign: 'center' }}><Image src={CONFIG.SPRITES['icon_' + this.props.gauntlet.contest_data.secondary_skill].url} height={18} /></td>
								<td style={{ textAlign: 'center', verticalAlign: 'middle' }}>{this.props.match.opponent.min[1]}-{this.props.match.opponent.max[1]}</td>
							</tr>
						</tbody>
					</table>
				</div>

				<div style={{ gridArea: 'chance', justifySelf: 'center', alignSelf: 'center' }}>
					<Label className="ms-fontSize-l ms-fontWeight-semibold" style={{ padding: '0' }}><b>{this.props.match.chance}%</b> chance</Label>
					<Label className="ms-fontSize-l ms-fontWeight-semibold" style={{ padding: '0' }}><b>{this.props.match.opponent.value}</b> points</Label>
				</div>

				<div style={{ gridArea: 'button', justifySelf: 'center', alignSelf: 'center' }}>
				</div>

				<div style={{ gridArea: 'ocrewimage', position: 'relative' }}>
					<Image src={this.props.match.opponent.iconUrl} height={128} />
					<div className="ui olive circular label" style={{ position: 'absolute', left: '0', bottom: '0' }}>{this.props.match.opponent.crit_chance}%</div>
				</div>

				<span style={{ gridArea: 'ocrewname', justifySelf: 'center' }}>{STTApi.getCrewAvatarBySymbol(this.props.match.opponent.archetype_symbol).name}</span>
			</div>
			<div className="ui bottom attached blue button" onClick={this._playMatch}>Engage {this.props.match.opponent.name}</div>
		</div>;
	}
}

export class GauntletHelper extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			gauntlet: null,
			lastResult: null,
			lastErrorMessage: null,
			rewards: null,
			merits: STTApi.playerData.premium_earnable,
			// Recommendation calculation settings
			featuredSkillBonus: 10,
			critBonusDivider: 3,
			includeFrozen: false,
			calculating: false,
			logPath: undefined,
			showSpinner: true
		};

		this._reloadGauntletData = this._reloadGauntletData.bind(this);
		this._gauntletDataRecieved = this._gauntletDataRecieved.bind(this);
		this._payForNewOpponents = this._payForNewOpponents.bind(this);
		this._payToReviveCrew = this._payToReviveCrew.bind(this);
		this._clainRankedRewards = this._clainRankedRewards.bind(this);
		this._calculateSelection = this._calculateSelection.bind(this);
		this._startGauntlet = this._startGauntlet.bind(this);
		this._exportLog = this._exportLog.bind(this);
		this._reloadGauntletData();
	}

	_reloadGauntletData() {
		loadGauntlet().then((data) => this._gauntletDataRecieved({ gauntlet: data }));
	}

	_clainRankedRewards() {
		claimRankRewards(this.state.gauntlet.id).then((results) => {
			// TODO: how can we show this to the user while going back to the unstarted state? Perhaps a modal dialog of sorts
			let lootbox = `You've got ${results.description.quantity} loot boxes of ${results.description.loot_box_rarity} rarity!`;
			let rewards = results.rewards.loot;

			console.log(lootbox);
			console.log(rewards);
		}).then(() => loadGauntlet()).then((data) => this._gauntletDataRecieved({ gauntlet: data }));
	}

	_payForNewOpponents() {
		payToGetNewOpponents(this.state.gauntlet.id).then((data) => {
			if (data.gauntlet) {
				this._gauntletDataRecieved(data);
			} else if (data.message) {
				this.setState({
					lastErrorMessage: data.message
				});
			}
		});
	}

	_payToReviveCrew(crew_id, save) {
		payToReviveCrew(this.state.gauntlet.id, crew_id, save).then((data) => this._gauntletDataRecieved(data));
	}

	_gauntletDataRecieved(data, logPath, match) {
		if (data.gauntlet) {
			if (data.gauntlet.state == 'NONE') {
				this.setState({
					gauntlet: data.gauntlet,
					lastErrorMessage: null,
					lastResult: null,
					startsIn: formatTimeSeconds(data.gauntlet.seconds_to_join),
					featuredSkill: data.gauntlet.contest_data.featured_skill,
					traits: data.gauntlet.contest_data.traits.map(function (trait) { return STTApi.getTraitName(trait); }.bind(this))
				});
			}
			else if (data.gauntlet.state == 'STARTED') {
				// TODO: make this a configuration option (lower value will make gauntlet refresh faster, but percentage will be less accurate)
				let simulatedRounds = 20000;
				var result = gauntletRoundOdds(data.gauntlet, simulatedRounds);
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
				lastResult: Object.assign(data.lastResult, { match: match }),
				rewards: data.rewards
			});
		}

		if (data.merits) {
			this.setState({
				merits: data.merits
			});
		}

		// #!if ENV === 'electron'
		if (!logPath && data.gauntlet) {
			logPath = Logger.hasGauntletLog(data.gauntlet.gauntlet_id);
		}
		// #!endif

		this.setState({ logPath: logPath, showSpinner: false });
	}

	_calculateSelection() {
		this.setState({ calculating: true })
		var result = gauntletCrewSelection(this.state.gauntlet, STTApi.roster, (100 + this.state.featuredSkillBonus) / 100, this.state.critBonusDivider, 5 /*preSortCount*/, this.state.includeFrozen);
		this.setState({ crewSelection: result.recommendations, calculating: false });
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

			if (crew_ids.length === 5) {
				enterGauntlet(this.state.gauntlet.gauntlet_id, crew_ids).then((data) => this._gauntletDataRecieved({ gauntlet: data }));
			}
		}
	}

	renderBestCrew() {
		if (!this.state.crewSelection) {
			return <span />;
		}

		let crewSpans = [];
		this.state.crewSelection.forEach(id => {
			let crew = STTApi.roster.find(crew => (crew.crew_id === id) || (crew.id === id));

			let crewSpan = <Persona
				key={crew.name}
				imageUrl={crew.iconUrl}
				text={crew.name}
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

	renderStatistic(value, label, classAdd) {
		return <div className={`${classAdd} ui statistic`}>
			<div className="value" style={{ color: classAdd || 'unset' }}>{value}</div>
			<div className="label" style={{ color: 'unset' }}>{label}</div>
		</div>;
	}

	render() {
		if (this.state.showSpinner)
			return <Spinner size={SpinnerSize.large} label='Loading gauntlet details...' />;

		if (this.state.gauntlet && (this.state.gauntlet.state == 'NONE')) {
			return (
				<div>
					<Label>Next gauntlet starts in {this.state.startsIn}.</Label>
					<span className='quest-mastery'>Featured skill: <Image src={CONFIG.SPRITES['icon_' + this.state.featuredSkill].url} height={18} /> {CONFIG.SKILLS[this.state.featuredSkill]}</span>
					<Label>Featured traits: {this.state.traits.join(', ')}</Label>

					{this.renderBestCrew()}

					<div className="ui grid" style={{ maxWidth: '600px' }}>
						<div className="row">
							<div className="column"><h4>Algorithm settings</h4></div>
						</div>

						<div className="two column row">
							<div className="column">
								<SpinButton value={this.state.featuredSkillBonus} label='Featured skill bonus:' min={0} max={100} step={1}
									onIncrement={(value) => { this.setState({ featuredSkillBonus: +value + 1 }); }}
									onDecrement={(value) => { this.setState({ featuredSkillBonus: +value - 1 }); }}
									onValidate={(value) => {
										if (isNaN(+value)) {
											this.setState({ featuredSkillBonus: 10 });
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
								<SpinButton value={this.state.critBonusDivider} label='Crit bonus divider:' min={0.1} max={100} step={0.1}
									onIncrement={(value) => { this.setState({ critBonusDivider: +value + 0.1 }); }}
									onDecrement={(value) => { this.setState({ critBonusDivider: +value - 0.1 }); }}
									onValidate={(value) => {
										if (isNaN(+value)) {
											this.setState({ critBonusDivider: 3 });
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

					<br />

					<PrimaryButton onClick={this._calculateSelection} text='Calculate best crew selection' disabled={this.state.calculating} />
					<span> </span>
					<PrimaryButton onClick={this._startGauntlet} text='Start gauntlet with recommendations' disabled={!this.state.crewSelection} />
				</div>
			);
		}
		else if (this.state.gauntlet && ((this.state.gauntlet.state == 'STARTED') && this.state.roundOdds)) {
			let playerCrew, opponentCrew, playerRoll, opponentRoll, playerRollMsg, opponentRollMsg;

			if (this.state.lastResult && this.state.lastResult.match) {
				playerCrew = STTApi.getCrewAvatarBySymbol(this.state.lastResult.match.crewOdd.archetype_symbol).name;
				opponentCrew = STTApi.getCrewAvatarBySymbol(this.state.lastResult.match.opponent.archetype_symbol).name;

				playerRoll = this.state.lastResult.player_rolls.reduce((sum, value) => { return sum + value; }, 0);
				opponentRoll = this.state.lastResult.opponent_rolls.reduce((sum, value) => { return sum + value; }, 0);

				playerRollMsg = [];
				opponentRollMsg = [];
				for (let i = 0; i < 6; i++) {
					playerRollMsg.push(`${this.state.lastResult.player_rolls[i]}${this.state.lastResult.player_crit_rolls[i] ? '*' : ''}`);
					opponentRollMsg.push(`${this.state.lastResult.opponent_rolls[i]}${this.state.lastResult.opponent_crit_rolls[i] ? '*' : ''}`);
				}
			}

			return (
				<div className='tab-panel' data-is-scrollable='true'>
					<span className='quest-mastery'>Featured skill is <Image src={CONFIG.SPRITES['icon_' + this.state.gauntlet.contest_data.featured_skill].url} height={18} /> {CONFIG.SKILLS[this.state.gauntlet.contest_data.featured_skill]}; Featured traits are {this.state.gauntlet.contest_data.traits.map(trait => STTApi.getTraitName(trait)).join(", ")}</span>
					<Label>Crew refreshes in {formatTimeSeconds(this.state.gauntlet.seconds_to_next_crew_refresh)} and the gauntlet ends in {formatTimeSeconds(this.state.gauntlet.seconds_to_end)}</Label>
					<div style={{ display: 'flex', width: '95%' }} >
						{this.state.gauntlet.contest_data.selected_crew.map((crew) => <GauntletCrew key={crew.crew_id} crew={crew} revive={(save) => this._payToReviveCrew(crew.crew_id, save)} />)}
					</div>

					{this.state.lastErrorMessage && <p>Error: '{this.state.lastErrorMessage}'</p>}

					<div className="ui compact segments" style={{ margin: '6px' }}>
						<div className="ui segment" style={{ backgroundColor: getTheme().palette.themeLighter }}>
							{this.renderStatistic(this.state.roundOdds.rank, 'Your rank')}
							{this.renderStatistic(this.state.roundOdds.consecutive_wins, 'Consecutive wins')}
							{this.renderStatistic(this.state.merits, 'Merits')}
							{this.state.lastResult && this.renderStatistic(((this.state.lastResult.win === true) ? 'WON' : 'LOST'), 'Last round', ((this.state.lastResult.win === true) ? 'green' : 'red'))}
						</div>
						{this.state.lastResult && this.state.lastResult.match && <div className="ui segment" style={{ backgroundColor: getTheme().palette.themeLighterAlt }}>
							<p>Your <b>{playerCrew}</b> rolled <b>{playerRoll}</b> ({playerRollMsg.join(', ')})</p>
							<p><i>{this.state.lastResult.match.opponent.name}</i>'s <b>{opponentCrew}</b> rolled <b>{opponentRoll}</b> ({opponentRollMsg.join(', ')})</p>
							{this.state.rewards &&
								<p>
									<span>Rewards: </span>
									{this.state.rewards.loot.map((loot, index) =>
										<span key={index} style={{ color: loot.rarity && CONFIG.RARITIES[loot.rarity].color }}>{loot.quantity} {(loot.rarity == null) ? '' : CONFIG.RARITIES[loot.rarity].name} {loot.full_name}</span>
									).reduce((prev, curr) => [prev, ', ', curr])}
								</p>
							}
						</div>}
					</div>

					<br />
					<div style={{ display: 'grid', gridGap: '10px', maxWidth: '550px', gridTemplateColumns: '1fr 1fr' }}>
						{(this.state.roundOdds.matches.length > 0) &&
							<PrimaryButton onClick={this._payForNewOpponents} text='Pay merits for new opponents' iconProps={{ iconName: 'Money' }} />
						}
						<DefaultButton onClick={this._reloadGauntletData} text='Reload data' iconProps={{ iconName: 'Refresh' }} />
					</div>
					<br />

					<div style={{ display: 'grid', gridGap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
						{this.state.roundOdds.matches.map((match) =>
							<GauntletMatch key={match.crewOdd.archetype_symbol + match.opponent.player_id} match={match} gauntlet={this.state.gauntlet} consecutive_wins={this.state.roundOdds.consecutive_wins} onNewData={this._gauntletDataRecieved} />
						)}
					</div>

					<br />

					{this.state.logPath && <PrimaryButton onClick={this._exportLog} text='Export log...' iconProps={{ iconName: 'DownloadDocument' }} />}
				</div>
			);
		} else if (this.state.gauntlet && (this.state.gauntlet.state == 'ENDED_WITH_REWARDS')) {
			return <div>
				<h3>Gauntlet ended.</h3>
				<PrimaryButton onClick={this._clainRankedRewards} text='Claim rewards and select new crew' />
				<p>Note: you won't see the rewards here, you'll go straight to crew selection. Claim rewards in the game client to see them. !THIS FEATURE IS UNTESTED!</p>
			</div>;
		}
		else {
			return (<MessageBar messageBarType={MessageBarType.error} >Unknown state for this gauntlet! Check the app, perhaps it's waiting to join or already done.</MessageBar>);
		}
	}

	async _exportLog() {
		// #!if ENV === 'electron'
		let csv = await Logger.exportGauntletLog(this.state.gauntlet.gauntlet_id);
		download(`gauntlet_${this.state.gauntlet.gauntlet_id}.csv`, csv, 'Export gauntlet log', 'Export');
		// #!endif
	}
}