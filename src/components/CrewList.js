import '../assets/css/fabric.min.css';

import React from 'react';
import { DetailsList, DetailsListLayoutMode, SelectionMode } from 'office-ui-fabric-react/lib/DetailsList';
import { Image, ImageFit } from 'office-ui-fabric-react/lib/Image';
import { Link } from 'office-ui-fabric-react/lib/Link';
import { Label } from 'office-ui-fabric-react/lib/Label';
import { Icon } from 'office-ui-fabric-react/lib/Icon';
import { IconButton } from 'office-ui-fabric-react/lib/Button';
import { HoverCard } from 'office-ui-fabric-react/lib/HoverCard';

import { SkillCell } from './SkillCell';
import { ActiveCrewDialog } from './ActiveCrewDialog';
import { RarityStars } from './RarityStars';
import { ItemDisplay } from './ItemDisplay';

import { sortItems, columnClick } from '../utils/listUtils.js';

import STTApi from 'sttapi';
import { CONFIG } from 'sttapi';

function groupBy(items, fieldName) {
	let groups = items.reduce((currentGroups, currentItem, index) => {
		let lastGroup = currentGroups[currentGroups.length - 1];
		let fieldValue = currentItem[fieldName];

		if (!lastGroup || lastGroup.value !== fieldValue) {
			currentGroups.push({
				key: 'group' + fieldValue + index,
				name: CONFIG.RARITIES[fieldValue].name + " crew",
				value: fieldValue,
				startIndex: index,
				level: 0,
				count: 0
			});
		}
		if (lastGroup) {
			lastGroup.count = index - lastGroup.startIndex;
		}
		return currentGroups;
	}, []);

	// Fix last group count
	let lastGroup = groups[groups.length - 1];

	if (lastGroup) {
		lastGroup.count = items.length - lastGroup.startIndex;
	}

	return groups;
}

export class CrewList extends React.Component {
	constructor(props) {
		super(props);

		const _columns = [
			{
				key: 'icon',
				name: '',
				minWidth: 50,
				maxWidth: 50,
				fieldName: 'name',
				onRender: (item) => {
					return (<Image src={item.iconUrl} width={50} height={50} imageFit={ImageFit.contain} shouldStartVisible={true} />);
				}
			},
			{
				key: 'short_name',
				name: 'Name',
				minWidth: 80,
				maxWidth: 100,
				isResizable: true,
				fieldName: 'short_name',
				onRender: (item) => {
					return (<Link href={'https://stt.wiki/wiki/' + item.name.split(' ').join('_')} target='_blank'>{item.short_name}</Link>);
				}
			},
			{
				key: 'name',
				name: 'Full name',
				minWidth: 100,
				maxWidth: 180,
				isResizable: true,
				onRender: (item) => {
					return (<HoverCard id="nameHoverCard"
						expandingCardProps={{
							compactCardHeight: 180,
							expandedCardHeight: 420,
							renderData: item,
							onRenderExpandedCard: this._onRenderExpandedCard,
							onRenderCompactCard: this._onRenderCompactCard,
							styles: { root: { width: '520px' } }
						}}
						instantOpenOnClick={true}>
						<span>{item.name}</span>
					</HoverCard>);
				}
			},
			{
				key: 'level',
				name: 'Level',
				minWidth: 30,
				maxWidth: 50,
				isResizable: true,
				fieldName: 'level'
			},
			{
				key: 'max_rarity',
				name: 'Rarity',
				fieldName: 'max_rarity',
				minWidth: 70,
				maxWidth: 100,
				isResizable: true,
				onRender: (item) => {
					return (
						<RarityStars
							min={1}
							max={item.max_rarity}
							value={item.rarity ? item.rarity : null}
						/>
					);
				},
				isPadded: true
			},
			{
				key: 'frozen',
				name: 'Frozen',
				minWidth: 16,
				maxWidth: 16,
				iconName: 'Snowflake',
				isIconOnly: true,
				fieldName: 'frozen',
				onRender: (item) => {
					if (item.frozen)
						return (<Icon iconName='Snowflake' />);
					else
						return (<p />);
				}
			},
			{
				key: 'buyback',
				name: 'Buy-back',
				minWidth: 16,
				maxWidth: 16,
				iconName: 'EmptyRecycleBin',
				isIconOnly: true,
				fieldName: 'buyback',
				onRender: (item) => {
					if (item.buyback)
						return (<Icon iconName='EmptyRecycleBin' />);
					else
						return (<p />);
				}
			},
			{
				key: 'active_id',
				name: 'Buy-back',
				minWidth: 16,
				maxWidth: 16,
				iconName: 'Balloons',
				isIconOnly: true,
				fieldName: 'active_id',
				onRender: (item) => {
					if (item.active_id)
						return (<IconButton iconProps={{ iconName: 'Balloons' }} title='Active engagement' onClick={() => this._showActiveDialog(item.active_id, item.name)} />);
					else
						return (<p />);
				}
			},
			{
				key: 'command_skill',
				name: 'Command',
				minWidth: 70,
				maxWidth: 100,
				isResizable: true,
				fieldName: 'command_skill_core',
				onRender: (item) => {
					return (<SkillCell skill={item.command_skill} />);
				}
			},
			{
				key: 'diplomacy_skill',
				name: 'Diplomacy',
				minWidth: 70,
				maxWidth: 100,
				isResizable: true,
				fieldName: 'diplomacy_skill_core',
				onRender: (item) => {
					return (<SkillCell skill={item.diplomacy_skill} />);
				}
			},
			{
				key: 'engineering_skill',
				name: 'Engineering',
				minWidth: 75,
				maxWidth: 100,
				isResizable: true,
				fieldName: 'engineering_skill_core',
				onRender: (item) => {
					return (<SkillCell skill={item.engineering_skill} />);
				}
			},
			{
				key: 'medicine_skill',
				name: 'Medicine',
				minWidth: 70,
				maxWidth: 100,
				isResizable: true,
				fieldName: 'medicine_skill_core',
				onRender: (item) => {
					return (<SkillCell skill={item.medicine_skill} />);
				}
			},
			{
				key: 'science_skill',
				name: 'Science',
				minWidth: 70,
				maxWidth: 100,
				isResizable: true,
				fieldName: 'science_skill_core',
				onRender: (item) => {
					return (<SkillCell skill={item.science_skill} />);
				}
			},
			{
				key: 'security_skill',
				name: 'Security',
				minWidth: 70,
				maxWidth: 100,
				isResizable: true,
				fieldName: 'security_skill_core',
				onRender: (item) => {
					return (<SkillCell skill={item.security_skill} />);
				}
			},
			{
				key: 'traits',
				name: 'Traits',
				minWidth: 120,
				isResizable: true,
				fieldName: 'traits'
			}
		];

		let sortColumn = props.sortColumn ? props.sortColumn : 'max_rarity';

		_columns.forEach(function (column) {
			if (column.key == sortColumn) {
				column.isSorted = true;
				column.isSortedDescending = false;
			}
		});

		if (props.grouped === false) {
			this.state = {
				items: sortItems(props.data, sortColumn),
				columns: _columns,
				groups: null,
				groupedColumn: '',
				sortColumn: sortColumn,
				sortedDescending: false,
				isCompactMode: true
			};
		}
		else {
			this.state = {
				items: sortItems(props.data, sortColumn),
				columns: _columns,
				groups: groupBy(props.data, 'max_rarity'),
				groupedColumn: 'max_rarity',
				sortColumn: sortColumn,
				sortedDescending: false,
				isCompactMode: true
			};
		}

		this._onColumnClick = this._onColumnClick.bind(this);
		this._showActiveDialog = this._showActiveDialog.bind(this);
		this._onRenderExpandedCard = this._onRenderExpandedCard.bind(this);
		this._onRenderCompactCard = this._onRenderCompactCard.bind(this);
	}

	_onRenderCompactCard(item) {
		return (
			<div className="ms-Grid">
				<div className="ms-Grid-row">
					<div className="ms-Grid-col ms-sm6 ms-md4 ms-lg4">
						<Image src={item.iconBodyUrl} height={180} imageFit={ImageFit.contain} shouldStartVisible={true} />
					</div>
					<div className="ms-Grid-col ms-sm6 ms-md8 ms-lg8" style={{ padding: '10px' }}>
						<Label className="ms-font-m-plus">{item.name}</Label>
						<Label className="ms-font-s">Traits: {item.traits.replace(new RegExp(',', 'g'), ', ')}</Label>
						<Label className="ms-font-xs">{item.flavor}</Label>
					</div>
				</div>
			</div>
		);
	}

	_onRenderExpandedCard(item) {
		let equipment = [];
		item.equipment_slots.forEach(es => {
			equipment.push(
				{
					e: STTApi.itemArchetypeCache.archetypes.find(equipment => equipment.id === es.archetype),
					have: es.have
				}
			);
		});

		let eqTable;
		if (equipment && equipment.length > 0) {
			eqTable = (<div>
				<Label className="ms-font-m-plus">Equipment</Label>
				<table><tbody>
					<tr>
						{
							equipment.map(eq => {
								if (eq.e) {
									return (<td key={eq.e.name}>
										<ItemDisplay src={eq.e.iconUrl} size={100} maxRarity={eq.e.rarity} rarity={eq.e.rarity} />
										<Label className="ms-font-xs" style={{ color: eq.have ? "" : "red" }}>{eq.e.name}</Label>
									</td>);
								}
								else {
									return <td></td>;
								}
							})
						}
					</tr></tbody>
				</table>
			</div>);
		}

		return (
			<div style={{ padding: '10px' }}>
				{eqTable}
				<Label className="ms-font-m-plus">Ship abilitiy '{item.action.name}'</Label>
				<Label>Accuracy +{item.ship_battle.accuracy}  Crit Bonus +{item.ship_battle.crit_bonus}  {item.ship_battle.crit_chance && <span>Crit Rating +{item.ship_battle.crit_chance}  </span>}Evasion +{item.ship_battle.evasion}</Label>
				<Label>Increase {CONFIG.CREW_SHIP_BATTLE_BONUS_TYPE[item.action.bonus_type]} by {item.action.bonus_amount}</Label>
				{item.action.penalty && <Label>Decrease {CONFIG.CREW_SHIP_BATTLE_BONUS_TYPE[item.action.penalty.type]} by {item.action.penalty.amount}</Label>}

				{item.action.ability && <Label>Ability: {CONFIG.CREW_SHIP_BATTLE_ABILITY_TYPE[item.action.ability.type].replace('%VAL%', item.action.ability.amount)} {(item.action.ability.condition > 0) && <span>Trigger: {CONFIG.CREW_SHIP_BATTLE_TRIGGER[item.action.ability.condition]}</span>}</Label>}
				<Label>Duration: {item.action.duration}s  Cooldown: {item.action.cooldown}s  Initial Cooldown: {item.action.initial_cooldown}s  </Label>
				{item.action.limit && <Label>Limit: {item.action.limit} uses per battle</Label>}

				{this.renderChargePhases(item.action.charge_phases)}
			</div>
		);
	}

	renderChargePhases(charge_phases) {
		if (!charge_phases) {
			return <span/>;
		} else {
			let phases = [];
			charge_phases.forEach((cp, idx) => {
				let phaseDescription = `Charge time: ${cp.charge_time}s`;

				if (cp.ability_amount) {
					phaseDescription += `  Ability amount: ${cp.ability_amount}`;
				}

				if (cp.bonus_amount) {
					phaseDescription += `  Bonus amount: ${cp.bonus_amount}`;
				}

				if (cp.duration) {
					phaseDescription += `  Duration: ${cp.duration}s`;
				}

				if (cp.cooldown) {
					phaseDescription += `  Cooldown: ${cp.cooldown}s`;
				}

				phases.push(<Label key={idx}>{phaseDescription}</Label>);
			});

			return (<div>
				<Label className="ms-font-m-plus">Charge phases</Label>
				<div>
					{phases}
				</div>
			</div>);
		}
	}

	render() {
		let { columns, items, groups } = this.state;

		return (
			<div className={this.props.overrideClassName ? this.props.overrideClassName : 'data-grid'} data-is-scrollable='true'>
				<DetailsList
					items={items}
					groups={groups}
					columns={columns}
					setKey='set'
					selectionMode={SelectionMode.none}
					layoutMode={DetailsListLayoutMode.justified}
					onColumnHeaderClick={this._onColumnClick}
				/>
				<ActiveCrewDialog ref='activeCrewDialog' />
			</div>
		);
	}

	_filterCrew(crew, searchString) {
		return searchString.split(' ').every(text => {
			// search the name first
			if (crew.name.toLowerCase().indexOf(text) > -1) {
				return true;
			}

			// now search the traits
			if (crew.traits.toLowerCase().indexOf(text) > -1) {
				return true;
			}

			// now search the raw traits
			if (crew.rawTraits.find(trait => { trait.toLowerCase().indexOf(text) > -1 })) {
				return true;
			}

			return false;
		});
	}

	filter(newValue) {
		this.setState({
			items: sortItems((newValue ?
				this.props.data.filter(i => this._filterCrew(i, newValue.toLowerCase())) :
				this.props.data), this.state.sortColumn, this.state.sortedDescending)
		});
	}

	getGroupedColumn() {
		return this.state.groupedColumn;
	}

	setGroupedColumn(groupedColumn) {
		if (groupedColumn == '')
			this.setState({ groupedColumn: '', groups: null });
		else
			this.setState({ groupedColumn: groupedColumn, groups: groupBy(this.state.items, groupedColumn) });
	}

	_onColumnClick(ev, column) {
		if (column.fieldName != this.state.groupedColumn) {
			this.setGroupedColumn('');
		}

		this.setState(columnClick(this.state.items, this.state.columns, column));

		if (this.state.groupedColumn == '')
			this.setState({ groups: null });
		else
			this.setState({ groups: groupBy(this.state.items, this.state.groupedColumn) });
	}

	_showActiveDialog(active_id, name) {
		this.refs.activeCrewDialog.show(active_id, name);
	}
}
