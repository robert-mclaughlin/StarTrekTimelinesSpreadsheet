import React from 'react';

import { Button, Image, Item, List } from 'semantic-ui-react';

import STTApi from 'sttapi';
import { CONFIG, shuttleComplete, shuttleRedeemToken, shuttleStart, formatTimeSeconds } from 'sttapi';

export class Shuttles extends React.Component {
	constructor(props) {
		super(props);

		let currentEvent = undefined;
		if (
			STTApi.playerData.character.events &&
			STTApi.playerData.character.events.length > 0 &&
			STTApi.playerData.character.events[0].content.content_type === 'shuttles' &&
			STTApi.playerData.character.events[0].opened
		) {
			// In a shuttle event
			let event = STTApi.playerData.character.events[0];

			STTApi.imageProvider
				.getImageUrl(event.phases[event.opened_phase].splash_image.file, event.id)
				.then(found => {
					this.setState({ eventImageUrl: found.url });
				})
				.catch(error => {
					console.warn(error);
				});

			let crew_bonuses = [];
			for (let cb in event.content.shuttles[0].crew_bonuses) {
				let avatar = STTApi.getCrewAvatarBySymbol(cb);
				if (!avatar) {
					continue;
				}

				crew_bonuses.push({
					avatar,
					bonus: event.content.shuttles[0].crew_bonuses[cb],
					iconUrl: STTApi.imageProvider.getCrewCached(avatar, false)
				});
			}

			let eventVP = event.content.shuttles[0].shuttle_mission_rewards.find(r => r.type === 11);
			currentEvent = {
				name: event.name,
				description: event.description,
				crew_bonuses: crew_bonuses,
				tokens: event.content.shuttles.map(s => s.token),
				nextVP: eventVP ? eventVP.quantity : 0
			};
		}

		this.state = {
			currentEvent,
			eventImageUrl: undefined,
			shuttles: STTApi.playerData.character.shuttle_adventures.map(adventure => adventure.shuttles[0])
		};
	}

	getState(state) {
		switch (state) {
			case 0:
				return 'Opened';
			case 1:
				return 'In process';
			case 2:
				return 'Complete';
			case 3:
				return 'Expired';
			default:
				return 'UNKNOWN';
		}
	}

	async _completeShuttle(shuttle_id) {
		let promises = [];
		for (let i = 0; i < 21; i++) {
			promises.push(shuttleComplete(shuttle_id));
		}

		await Promise.all(promises)
			.catch(error => {
				/*console.warn(error);*/
			})
			.then(() => this.setState({ shuttles: STTApi.playerData.character.shuttle_adventures.map(adventure => adventure.shuttles[0]) }));
	}

	renderShuttle(shuttle) {
		let faction = STTApi.playerData.character.factions.find(faction => faction.id === shuttle.faction_id);

		return (
			<Item key={shuttle.id}>
				<Item.Image size='small' src={faction.iconUrl} />

				<Item.Content verticalAlign='middle'>
					<Item.Header>
						{shuttle.name} {shuttle.is_rental ? ' (rental)' : ''}
					</Item.Header>
					<Item.Description>
						<p>{shuttle.description}</p>
						<p>Faction: {faction.name}</p>
						<p>Expires in {formatTimeSeconds(shuttle.expires_in)}</p>
					</Item.Description>
					<Item.Extra>
						State: {this.getState(shuttle.state)}
						{shuttle.state === 2 && <Button floated='right' onClick={() => this._completeShuttle(shuttle.id)} content='Complete' />}
					</Item.Extra>
				</Item.Content>
			</Item>
		);
	}

	renderEvent() {
		const event = this.state.currentEvent;

		if (!event) {
			return <span />;
		}

		return (
			<div>
				<h2>Current event: {event.name}</h2>
				<Image src={this.state.eventImageUrl} />
				<p>{event.description}</p>
				<h3>Crew bonuses:</h3>
				<List horizontal>
					{event.crew_bonuses.map(cb => (
						<List.Item>
							<Image avatar src={cb.iconUrl} />
							<List.Content>
								<List.Header>{cb.avatar.name}</List.Header>
								Bonus level {cb.bonus}
							</List.Content>
						</List.Item>
					))}
				</List>
				<h4>Next shuttle VP: {event.nextVP}</h4>
                <h3>Active shuttles</h3>
			</div>
		);
	}

	render() {
		return (
			<div className='tab-panel' data-is-scrollable='true'>
				<div style={{ padding: '10px' }}>
					{this.renderEvent()}
					<Item.Group divided>{this.state.shuttles.map(shuttle => this.renderShuttle(shuttle))}</Item.Group>
				</div>
			</div>
		);
	}
}
