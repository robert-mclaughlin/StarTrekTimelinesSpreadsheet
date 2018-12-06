import React from 'react';

import { Button, Image, Item, List, Dropdown } from 'semantic-ui-react';

import STTApi from 'sttapi';
import { CONFIG } from 'sttapi';

class GalaxyEvent extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			inGalaxyEvent: false
		};

		if (STTApi.playerData.character.events && STTApi.playerData.character.events.length > 0) {
			let activeEvent = STTApi.playerData.character.events[0];

			if (activeEvent.content && activeEvent.content.gather_pools && activeEvent.content.gather_pools.length > 0) {
				// TODO: share some of this code with Shuttles
				let sortedRoster = [];
				STTApi.roster.forEach(crew => {
					if (crew.buyback || crew.frozen || crew.active_id) {
						return;
					}

					let bonus = 1;
					if (activeEvent.content.crew_bonuses[crew.symbol]) {
						bonus = activeEvent.content.crew_bonuses[crew.symbol];
					}

					sortedRoster.push({
						crew_id: crew.id,
						command_skill: crew.command_skill_core * bonus,
						science_skill: crew.science_skill_core * bonus,
						security_skill: crew.security_skill_core * bonus,
						engineering_skill: crew.engineering_skill_core * bonus,
						diplomacy_skill: crew.diplomacy_skill_core * bonus,
						medicine_skill: crew.medicine_skill_core * bonus,
						total: 0
					});
				});

				let adventures = [];
				activeEvent.content.gather_pools[0].adventures.forEach(adventure => {
					if (adventure.golden_octopus) {
						return;
					}

					let demands = [];
					adventure.demands.forEach(demand => {
						let e = STTApi.itemArchetypeCache.archetypes.find(equipment => equipment.id === demand.archetype_id);
						console.log(e);

						let skills = e.recipe.jackpot.skills;

						let calcSlot = {
							bestCrew: JSON.parse(JSON.stringify(sortedRoster)) // Start with a copy
						};

						if (skills.length === 1) {
							// AND or single
							calcSlot.skills = skills[0].split(',');
							if (calcSlot.skills.length === 1) {
								calcSlot.type = 'SINGLE';
								calcSlot.bestCrew.forEach(c => {
									c.total = c[calcSlot.skills[0]];
								});
							} else {
								calcSlot.type = 'AND';
								calcSlot.bestCrew.forEach(c => {
									c.total = Math.floor((c[calcSlot.skills[0]] + c[calcSlot.skills[1]]) / 2);
								});
							}
						} else {
							// OR
							calcSlot.type = 'OR';
							calcSlot.skills = skills;
							calcSlot.bestCrew.forEach(c => {
								c.total = Math.max(c[calcSlot.skills[0]], c[calcSlot.skills[1]]);
							});
						}

						let seen = new Set();
						calcSlot.bestCrew = calcSlot.bestCrew.filter(c => c.total > 0).filter(c => (seen.has(c.crew_id) ? false : seen.add(c.crew_id)));
						calcSlot.bestCrew.sort((a, b) => a.total - b.total);
						calcSlot.bestCrew = calcSlot.bestCrew.reverse();

						calcSlot.bestCrew.forEach(c => {
							c.crew = STTApi.roster.find(cr => cr.id === c.crew_id);
							c.text = `${c.crew.name} (${c.total})`;
							c.value = c.crew.symbol;
							c.image = c.crew.iconUrl;
						});

						const calcChance = skillValue => {
							let midpointOffset = skillValue / STTApi.serverConfig.config.craft_config.specialist_challenge_rating;

							let val = Math.floor(
								100 /
									(1 +
										Math.exp(
											-STTApi.serverConfig.config.craft_config.specialist_chance_formula.steepness *
												(midpointOffset - STTApi.serverConfig.config.craft_config.specialist_chance_formula.midpoint)
										))
							);

							return Math.min(val, STTApi.serverConfig.config.craft_config.specialist_maximum_success_chance);
						};

						let bestCrewChance = calcChance(calcSlot.bestCrew[0].total);

						if (e.recipe.jackpot.trait_bonuses) {
							for (let trait in e.recipe.jackpot.trait_bonuses) {
								if (calcSlot.bestCrew[0].crew.rawTraits.includes(trait)) {
									bestCrewChance += e.recipe.jackpot.trait_bonuses[trait];
								}
							}
						}

						bestCrewChance = Math.floor(Math.min(bestCrewChance, 1) * 100);

						let itemDemands = [];
						for (let rd of e.recipe.demands) {
							let item = STTApi.playerData.character.items.find(item => item.archetype_id === rd.archetype_id);
							itemDemands.push({
								rd,
								item
							});
						}

						let have = STTApi.playerData.character.items.find(item => item.archetype_id === e.id);

						let craftCost = 0;
						if (e.type === 3) {
							craftCost = STTApi.serverConfig.config.craft_config.cost_by_rarity_for_component[e.rarity].amount;
						} else if (e.type === 2) {
							craftCost = STTApi.serverConfig.config.craft_config.cost_by_rarity_for_equipment[e.rarity].amount;
						} else {
							console.warn('Equipment of unknown type', e);
						}

						demands.push({
							equipment: e,
							bestCrewChance,
                            calcSlot,
                            craftCost,
							have: have ? have.quantity : 0,
							itemDemands
						});
					});

					adventures.push({
						name: adventure.name,
						demands
					});
				});

				this.state = {
					inGalaxyEvent: true,
					event: activeEvent,
					adventures
				};
			}
		}
	}

	_craft(equipmentId, crewId, recipeValidHash) {
		STTApi.executePostRequestWithUpdates('item/craft', { id: equipmentId, crew_buff_id: crewId, recipe_valid: recipeValidHash }).then(
			buyData => {
				//TODO: refresh
			}
		);
	}

	render() {
		if (!this.state.inGalaxyEvent) {
			return <p>Not in a galaxy event!</p>;
		}

		return (
			<div>
				<h3>Galaxy event: {this.state.event.name}</h3>
				<p>Crew bonuses: {JSON.stringify(this.state.event.content.crew_bonuses)}</p>
				{this.state.adventures.map(adventure => (
					<div key={adventure.name}>
						<h4>{adventure.name}</h4>
						<Item.Group>
							{adventure.demands.map(demand => (
								<Item key={demand.equipment.name}>
									<Item.Image size='tiny' src={demand.equipment.iconUrl} />
									<Item.Content>
										<Item.Header>
											{demand.equipment.name} (have {demand.have})
										</Item.Header>
										<Item.Description>
											<p>
												{demand.itemDemands
													.map(id => `${id.item ? id.item.name : 'NEED'} x ${id.rd.count} (have ${id.item ? id.item.quantity : 0})`)
													.join(', ')}
											</p>
											<p>
												Best crew: {demand.calcSlot.bestCrew[0].crew.name} ({demand.bestCrewChance}%)
											</p>
										</Item.Description>
										<Item.Extra>
											<Button
												floated='right'
												onClick={() =>
													this._craft(demand.equipment.id, demand.calcSlot.bestCrew[0].crew.crew_id, demand.equipment.recipe.validity_hash)
												}
												content={`Craft (${demand.craftCost} credits)`}
											/>
										</Item.Extra>
									</Item.Content>
								</Item>
							))}
						</Item.Group>
					</div>
				))}
			</div>
		);
	}
}

export class Experiments extends React.Component {
	constructor(props) {
		super(props);
	}

	render() {
		return (
			<div className='tab-panel' data-is-scrollable='true'>
				<h2>This page contains unfinished experiments, for developer testing; you probably don't want to invoke any buttons here :)</h2>
				<GalaxyEvent />
			</div>
		);
	}
}
