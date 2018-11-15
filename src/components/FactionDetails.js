import React from 'react';

import { ItemDisplay } from './ItemDisplay';

import STTApi from 'sttapi';
import { CONFIG, refreshAllFactions, loadFactionStore } from 'sttapi';

class StoreItem extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        let curr = CONFIG.CURRENCIES[this.props.storeItem.offer.cost.currency];

        let locked = this.props.storeItem.locked || (this.props.storeItem.offer.purchase_avail === 0);

        return <div className={"ui labeled button compact tiny" + (locked ? " disabled" : "")} onClick={() => this.props.onBuy()}>
            <div className="ui button compact tiny">
                {this.props.storeItem.offer.game_item.name}
            </div>
            <a className="ui blue label">
                <span style={{ display: 'inline-block' }}><img src={CONFIG.SPRITES[curr.icon].url} height={16} /></span>
                {this.props.storeItem.offer.cost.amount} {curr.name}
            </a>
        </div>;
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

        STTApi.imageProvider.getImageUrl(this.props.faction.reputation_item_icon.file, this.props.faction).then((found) => {
            this.props.faction.reputationIconUrl = found.url;
            this.setState({ reputationIconUrl: found.url });
        }).catch((error) => { console.warn(error); });

        this.state = {
            reputationIconUrl: '',
            showSpinner: true,
            rewards: equipment
        };

        this.refreshStore();
    }

    refreshStore() {
        loadFactionStore(this.props.faction).then(() => {
            this.setState({
                showSpinner: false,
                storeItems: this.props.faction.storeItems
            });
        });
    }

    _buyItem(storeItem) {
        let id = storeItem.symbol + ':';
        if (storeItem.offer.game_item.hash_key) {
            id += storeItem.offer.game_item.hash_key;
        }

        this.setState({ showSpinner: true });

        STTApi.executePostRequestWithUpdates('commerce/buy_direct_offer', { id, layout: this.props.faction.shop_layout, e: 0 }).then((buyData) => {
            this.refreshStore();
        });
    }

    renderStoreItems() {
        if (this.state.showSpinner) {
            return <div className="centeredVerticalAndHorizontal">
                <div className="ui centered text active inline loader">Loading {this.props.faction.name} faction store...</div>
            </div>;
        }

        return <div style={{ lineHeight: '2.5' }}>
            {this.state.storeItems.map((storeItem, idx) => <StoreItem key={idx} storeItem={storeItem} onBuy={() => this._buyItem(storeItem)} />).reduce((prev, curr) => [prev, ' ', curr])}
        </div>;
    }

    _getReputationName(reputation) {
        for(let repBucket of STTApi.platformConfig.config.faction_config.reputation_buckets) {
            if ((reputation < repBucket.upper_bound) || !repBucket.upper_bound) {
                return repBucket.name;
            }
        }

        return 'Unknown';
    }

    render() {
        let token = STTApi.playerData.character.items.find(item => item.archetype_id === this.props.faction.shuttle_token_id);
        let tokens = token ? token.quantity : 0;

        return <div style={{ paddingBottom: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'min-content auto', gridTemplateAreas: `'icon description'`, gridGap: '10px' }}>
                <div style={{ gridArea: 'icon' }}>
                    <img src={this.state.reputationIconUrl} height={90} />
                </div>
                <div style={{ gridArea: 'description' }}>
                    <h4>{this.props.faction.name}</h4>
                    <p>Reputation: {this._getReputationName(this.props.faction.reputation)} ({this.props.faction.completed_shuttle_adventures} completed shuttle adventures)</p>
                    <p>Transmissions: {tokens}</p>
                </div>
            </div>
            <h5>Potential shuttle rewards</h5>
            {this.state.rewards.map((item, idx) => <span style={{ display: 'contents' }} key={idx}><ItemDisplay style={{ display: 'inline-block' }} src={item.iconUrl} size={24} maxRarity={item.rarity} rarity={item.rarity} /> {item.name} </span>)}
            <h5>Store</h5>
            {this.renderStoreItems()}
        </div>;
    }
}

export class FactionDetails extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            showSpinner: true
        };

        refreshAllFactions().then(() => {
            this.setState({
                showSpinner: false
            });
        });
    }

    render() {
        if (this.state.showSpinner) {
            return <div className="centeredVerticalAndHorizontal">
                <div className="ui massive centered text active inline loader">Loading factions...</div>
            </div>;
        }

        return <div className='tab-panel' data-is-scrollable='true'>
            {STTApi.playerData.character.factions.map(faction => <FactionDisplay key={faction.name} faction={faction} />)}
        </div>;
    }
}