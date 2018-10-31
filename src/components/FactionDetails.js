import React from 'react';

import STTApi from 'sttapi';

export class FactionDetails extends React.Component {
	constructor(props) {
        super(props);

        this.state = {
            showSpinner: true,
            spinnerLabel: 'factions'
        };

        STTApi.executeGetRequestWithUpdates("character/refresh_all_factions").then(async (data) => {
            let storeItems = [];
            for(let faction of STTApi.playerData.character.factions)
            {
                this.setState({
                    spinnerLabel: `${faction.name} faction details`
                });

                STTApi.imageProvider.getImageUrl(faction.icon.file, faction).then((found) => {
                    found.id.iconUrl = found.url;
                }).catch((error) => { console.warn(error); });

                let factionData = await STTApi.executeGetRequestWithUpdates("commerce/store_layout_v2/" + faction.shop_layout);

                factionData[0].grids.forEach(grid => {
                    storeItems.push({
                        factionName: faction.name,
                        fullName: grid.primary_content[0].offer.game_item.full_name,
                        costAmount: grid.primary_content[0].cost.amount,
                        costCurrency: grid.primary_content[0].cost.currency,
                        locked: grid.primary_content[0].locked
                    });
                });
            }

            this.setState({
                showSpinner: false,
                storeItems
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
            NYI {JSON.stringify(this.state.storeItems)}
        </div>;
	}
}