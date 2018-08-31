import React from 'react';
import { DetailsList, DetailsListLayoutMode, SelectionMode } from 'office-ui-fabric-react/lib/DetailsList';
import { Image, ImageFit } from 'office-ui-fabric-react/lib/Image';
import { PrimaryButton } from 'office-ui-fabric-react/lib/Button';
import { Spinner, SpinnerSize } from 'office-ui-fabric-react/lib/Spinner';

import { CollapsibleSection } from './CollapsibleSection';
import { RarityStars } from './RarityStars';

import { loginPubNub } from '../utils/chat';
import { sortItems, columnClick } from '../utils/listUtils';
import { download } from '../utils/pal';

import STTApi from 'sttapi';
import { formatTimeSeconds } from 'sttapi';

import { parse as json2csv } from 'json2csv';

export class MemberList extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			members: sortItems(this.props.members, 'display_name'),
			columns: [
				{
					key: 'icon',
					name: '',
					minWidth: 32,
					maxWidth: 32,
					fieldName: 'display_name',
					onRender: (item) => {
						if (item.iconUrl)
							return (<Image src={item.iconUrl} width={32} height={32} imageFit={ImageFit.contain} />);
						else
							return <span />
					}
				},
				{
					key: 'display_name',
					name: 'Name',
					minWidth: 100,
					maxWidth: 180,
					isSorted: true,
					isSortedDescending: false,
					isResizable: true,
					fieldName: 'display_name'
				},
				{
					key: 'rank',
					name: 'Rank',
					minWidth: 50,
					maxWidth: 80,
					isResizable: true,
					fieldName: 'rank',
					isPadded: true
				},
				{
					key: 'squad_name',
					name: 'Squad',
					minWidth: 90,
					maxWidth: 150,
					isResizable: true,
					fieldName: 'squad_name',
					isPadded: true,
					onRender: (item) => {
						if (item.squad_name)
							return (<span>{item.squad_name} ({item.squad_rank})</span>);
						else
							return (<span style={{ color: 'red' }}>Not in a squad</span>);
					}
				},
				{
					key: 'last_active',
					name: 'Last active',
					minWidth: 70,
					maxWidth: 100,
					isResizable: true,
					fieldName: 'last_active',
					onRender: (item) => <span>{formatTimeSeconds(item.last_active)}</span>
				},
				{
					key: 'daily_activity',
					name: 'Daily activity',
					minWidth: 50,
					maxWidth: 80,
					isResizable: true,
					fieldName: 'daily_activity'
				},
				{
					key: 'event_rank',
					name: 'Event rank',
					minWidth: 50,
					maxWidth: 80,
					isResizable: true,
					fieldName: 'event_rank'
				},
				{
					key: 'level',
					name: 'Level',
					minWidth: 50,
					maxWidth: 80,
					isResizable: true,
					fieldName: 'level'
				},
				{
					key: 'location',
					name: 'Location',
					minWidth: 60,
					maxWidth: 110,
					isResizable: true,
					fieldName: 'location'
				},
				{
					key: 'currentShip',
					name: 'Current Ship',
					minWidth: 70,
					maxWidth: 110,
					isResizable: true,
					fieldName: 'currentShip'
				}
			]
		};

		this._onColumnClick = this._onColumnClick.bind(this);
		this._exportCSV = this._exportCSV.bind(this);
	}

	_onColumnClick(ev, column) {
		this.setState(columnClick(this.state.members, this.state.columns, column));
	}

	_exportCSV() {
		let fields = ['display_name', 'rank', 'squad_name', 'squad_rank', 'last_active', 'event_rank', 'level', 'daily_activity', 'location', 'currentShip'];
		let csv = json2csv(this.state.members, { fields: fields });

		let today = new Date();
		download(STTApi.fleetData.name + '-' + (today.getUTCMonth() + 1) + '-' + (today.getUTCDate())+ '.csv', csv, 'Export fleet member list', 'Export');
	}

	render() {
		return (<CollapsibleSection title={this.props.title}>
			<DetailsList
				items={this.state.members}
				columns={this.state.columns}
				setKey='set'
				selectionMode={SelectionMode.none}
				layoutMode={DetailsListLayoutMode.justified}
				onColumnHeaderClick={this._onColumnClick}
			/>
			<PrimaryButton onClick={this._exportCSV} text='Export member list as CSV...' />
		</CollapsibleSection>);
	}
}

export class Starbase extends React.Component {
	constructor(props) {
		super(props);

		let iconPromises = [];
		STTApi.starbaseRooms.forEach(room => {
			if ((room.level > 0) && !room.iconUrl) {
				iconPromises.push(STTApi.imageProvider.getItemImageUrl(room.upgrades[room.level].buffs[0], room).then((found) => {
					found.id.iconUrl = found.url;
				}).catch((error) => { /*console.warn(error);*/ }));

				iconPromises.push(STTApi.imageProvider.getImageUrl('/' + room.background, room).then((found) => {
					found.id.backgroundUrl = found.url;
				}).catch((error) => { /*console.warn(error);*/ }));
			}
		});

		this.state = { showSpinner: true };

		Promise.all(iconPromises).then(() => {
			this.setState({ showSpinner: false });
		});
	}

	render() {
		if (this.state.showSpinner)
			return <Spinner size={SpinnerSize.large} label='Loading starbase details...' />;

		const roomContainerStyle = {
			display: 'grid',
			maxWidth: '512px',
			padding: '8px',
			gridTemplateColumns: 'auto auto',
			gridTemplateRows: '24px 24px 24px 24px 24px 136px',
			gridTemplateAreas: `
			"image roomname"
			"image roomstars"
			"image buff1"
			"image buff2"
			"image upgrade"
			"image ."`};

		let rooms = [];
		STTApi.starbaseRooms.forEach(room => {
			let upgrade = room.upgrades[room.level];

			rooms.push(<div style={roomContainerStyle} key={room.id}>
				<img style={{ position: 'absolute', width: '512px', height: '256px', zIndex: 0, opacity: 0.3 }} src={room.backgroundUrl} />
				<span style={{ gridArea: 'roomname', justifySelf: 'start', fontSize: '1.5em', fontWeight: 700 }}>{room.name}</span>
				<span style={{ gridArea: 'roomstars', justifySelf: 'start' }}><RarityStars min={1} max={room.max_level} value={(room.level > 0) ? room.level : null} /></span>
				<span style={{ gridArea: 'buff1', justifySelf: 'start', fontSize: '1.4em', fontWeight: 600 }}>{upgrade.name}</span>
				<span style={{ gridArea: 'buff2', justifySelf: 'start', fontSize: '1.4em', fontWeight: 600 }}>{(upgrade.buffs && upgrade.buffs.length > 0) ? upgrade.buffs[0].name : ''}</span>
				<span style={{ gridArea: 'upgrade', justifySelf: 'start', fontSize: '1.4em', fontWeight: 600 }}>{room.recommended ? 'Donations recommended' : ''}</span>
				<img style={{ gridArea: 'image', width: '128px', height: '128px', justifySelf: 'center' }} src={room.iconUrl} />
			</div>);
		});

		return (<CollapsibleSection title={this.props.title}>
			{rooms}
		</CollapsibleSection>);
	}
}

export class ChatHistory extends React.Component {
	render() {
		if (!this.props.chatHistory) {
			return <span/>;
		} else {
		return (<CollapsibleSection title={this.props.title}>
			{this.props.chatHistory.map(function (message, idx) {
				return <p key={idx}><b>{message.from}</b> ({message.timeSent}): {message.text}</p>
			})}
		</CollapsibleSection>);
		}
	}
}

export class FleetDetails extends React.Component {
	constructor(props) {
		super(props);

		if (STTApi.playerData.fleet && STTApi.playerData.fleet.id != 0) {
			var members = new Array();

			STTApi.fleetMembers.forEach((member) => {
				var newMember = {
					dbid: member.dbid,
					pid: member.pid,
					level: 'unknown',
					location: 'unknown',
					currentShip: 'unknown',
					display_name: member.display_name,
					rank: member.rank,
					last_active: member.last_active,
					event_rank: member.event_rank,
					daily_activity: member.daily_activity,
					iconUrl: null,
					crew_avatar: member.crew_avatar
				};

				if (member.squad_id)
				{
					newMember.squad_rank = member.squad_rank;
					let squad = STTApi.fleetSquads.find((squad) => squad.id == member.squad_id);
					if (squad) {
						newMember.squad_name = squad.name;
						newMember.squad_event_rank = squad.event_rank;
					}
				}

				members.push(newMember);
			});

			this.state = {
				members: members,
				chatHistory: undefined
			};

			let iconPromises = [];
			this.state.members.forEach((member) => {
				if (member.crew_avatar) {
					iconPromises.push(STTApi.imageProvider.getCrewImageUrl(member.crew_avatar, false, member.dbid).then(({id, url}) => {
						this.state.members.forEach(function (member) {
							if (member.dbid === id)
								member.iconUrl = url;
						});

						return Promise.resolve();
					}).catch((error) => { }));
				}

				// Load player details
				iconPromises.push(STTApi.inspectPlayer(member.pid).then(memberData => {
					member.level = memberData.character.level;
					member.location = STTApi.playerData.character.navmap.places.find((place) => { return place.symbol == memberData.character.location.place; }).display_name;
					member.currentShip = memberData.character.current_ship.name;
				}));
			});
			Promise.all(iconPromises).then(() => this.forceUpdate());

			loginPubNub().then(data => {
				// retrieve recent history of messages
				data.pubnub.history(
					{
						channel: data.subscribedChannels.fleet,
						reverse: false,
						count: 30 // how many items to fetch
					},
					(status, response) => {
						// handle status, response
						if (response && response.messages) {
							let msgs = [];
							response.messages.forEach(function (message) {
								var msg = JSON.parse(decodeURIComponent(message.entry));
								msgs.push({
									from: msg.sourceName.replace(/\+/g, ' '),
									timeSent: new Date(msg.timeSent * 1000).toLocaleString(),
									text: msg.message.replace(/\+/g, ' ')
								});
							});

							this.setState({chatHistory: msgs});
						}
					}
				);
			}).catch(err => {
				console.error(err);
			});
		}
		else
		{
			this.state = {
				members: null,
				chatHistory: null
			};
		}
	}

	render() {
		if (!this.state.members) {
			return <p>It looks like you are not part of a fleet yet!</p>;
		}
		else {
			return <div className='tab-panel' data-is-scrollable='true'>
				<h2>{STTApi.fleetData.name}</h2>
				<h3>{STTApi.fleetData.motd}</h3>

				<MemberList title={'Members (' + STTApi.fleetData.cursize + ' / ' + STTApi.fleetData.maxsize + ')'} members={this.state.members} />

				<Starbase title='Starbase rooms' />

				<ChatHistory title='Fleet chat recent history' chatHistory={this.state.chatHistory} />
			</div>;
		}
	}
}