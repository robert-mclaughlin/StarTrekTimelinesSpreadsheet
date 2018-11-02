import React from 'react';

import { ItemDisplay } from './ItemDisplay';

import STTApi from 'sttapi';
import { CONFIG } from 'sttapi';

const CURRENCIES = {
    premium_earnable: {
        name: 'merits',
        icon: 'images_currency_pe_currency_0'
    },
    premium_purchasable: {
        name: 'dilithium',
        icon: 'images_currency_pp_currency_0'
    },
    nonpremium: {
        name: 'credits',
        icon: 'images_currency_sc_currency_0'
    }
};

class StoreItem extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        let curr = CURRENCIES[this.props.storeItem.costCurrency];

        return <div className={"ui labeled button compact tiny" + (this.props.storeItem.locked ? " disabled" : "")} onClick={() => this._buy()}>
            <div className="ui button compact tiny">
                {this.props.storeItem.game_item.name}
            </div>
            <a className="ui blue label">
                <span style={{ display: 'inline-block' }}><img src={CONFIG.SPRITES[curr.icon].url} height={16} /></span>
                {this.props.storeItem.costAmount} {curr.name}
            </a>
        </div>;
    }

    _buy() {
        alert('Not implemented! Go in the game to actually buy.');
    }
}

class FactionDisplay extends React.Component {
    constructor(props) {
        super(props);

        let rewardItemIds = new Set();
        const scanRewards = (potential_rewards) => {
            potential_rewards.forEach(reward => {
                if (reward.potential_rewards) {
                    scanRewards(reward.potential_rewards);
                } else if (reward.type === 2) {
                    rewardItemIds.add(reward.id);
                }
            });
        };

        scanRewards(this.props.faction.shuttle_mission_rewards);

        let equipment = [];
        rewardItemIds.forEach(itemId => {
            let eq = STTApi.itemArchetypeCache.archetypes.find(equipment => equipment.id === itemId);
            if (eq) {
                equipment.push(eq);
            }
        });

        this.state = {
            rewards: equipment
        };
    }

    render() {
        let token = STTApi.playerData.character.items.find(item => item.archetype_id === this.props.faction.shuttle_token_id);
        let tokens = token ? token.quantity : 0;

        // reputationIconUrl, iconUrl
        return <div style={{paddingBottom: '10px'}}>
            <div style={{ display: 'grid', gridTemplateColumns: 'min-content auto', gridTemplateAreas: `'icon description'`, gridGap: '10px' }}>
                <div style={{ gridArea: 'icon' }}>
                    <img src={this.props.faction.reputationIconUrl} height={90} />
                </div>
                <div style={{ gridArea: 'description' }}>
                    <h4>{this.props.faction.name}</h4>
                    <p>Reputation: {this.props.faction.reputation} ({this.props.faction.completed_shuttle_adventures} completed shuttle adventures)</p>
                    <p>Transmissions: {tokens}</p>
                </div>
            </div>
            <h5>Potential shuttle rewards</h5>
            {this.state.rewards.map((item, idx) => <span style={{ display: 'contents' }} key={idx}><ItemDisplay style={{ display: 'inline-block' }} src={item.iconUrl} size={24} maxRarity={item.rarity} rarity={item.rarity} /> {item.name} </span>)}
            <h5>Store</h5>
            <div style={{ lineHeight: '2.5' }}>
                {this.props.faction.storeItems.map((storeItem, idx) => <StoreItem key={idx} storeItem={storeItem} />).reduce((prev, curr) => [prev, ' ', curr])}
            </div>
        </div>;
    }
}

export class FactionDetails extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            showSpinner: true,
            spinnerLabel: 'factions'
        };

        STTApi.executeGetRequestWithUpdates("character/refresh_all_factions").then(async (data) => {
            let factions = [];
            for (let faction of STTApi.playerData.character.factions) {
                factions.push(faction);

                this.setState({
                    spinnerLabel: `${faction.name} faction details`
                });

                STTApi.imageProvider.getImageUrl(faction.icon.file, faction).then((found) => {
                    found.id.iconUrl = found.url;
                }).catch((error) => { console.warn(error); });

                STTApi.imageProvider.getImageUrl(faction.reputation_item_icon.file, faction).then((found) => {
                    found.id.reputationIconUrl = found.url;
                }).catch((error) => { console.warn(error); });

                let factionData = await STTApi.executeGetRequestWithUpdates("commerce/store_layout_v2/" + faction.shop_layout);

                faction.storeItems = [];
                factionData[0].grids.forEach(grid => {
                    faction.storeItems.push({
                        game_item: grid.primary_content[0].offer.game_item,
                        costAmount: grid.primary_content[0].cost.amount,
                        costCurrency: grid.primary_content[0].cost.currency,
                        locked: grid.primary_content[0].locked
                    });
                });
            }

            this.setState({
                showSpinner: false,
                factions
            });
        });
    }

    render() {
        if (this.state.showSpinner) {
            return <div className="centeredVerticalAndHorizontal">
                <div className="ui massive centered text active inline loader">Loading {this.state.spinnerLabel}...</div>
            </div>;
        }

        return <div className='tab-panel' data-is-scrollable='true'>
            {this.state.factions.map(faction => <FactionDisplay key={faction.name} faction={faction} />)}
        </div>;
    }
}