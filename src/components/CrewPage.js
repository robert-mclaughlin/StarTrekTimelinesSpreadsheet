import React from 'react';
import { SearchBox } from 'office-ui-fabric-react/lib/SearchBox';

import { CrewList } from './CrewList.js';
import { ShareDialog } from './ShareDialog.js';

import { exportExcel } from '../utils/excelExporter.js';
import { exportCsv } from '../utils/csvExporter.js';
import { shareCrew } from '../utils/pastebin.js';

import { download } from '../utils/pal';

import STTApi from 'sttapi';

export class CrewPage extends React.Component {
	constructor(props) {
        super(props);
        
        this.state = {
            showEveryone: false,
            crewData: this.loadCrewData(false)
        };
    }
    
    componentDidMount() {
        this.refs.crewList.filter('');

        this._updateCommandItems();
    }

    loadCrewData(showEveryone) {
        if (!showEveryone) {
            return STTApi.roster;
        }

        const isFFFE = (crew) => (crew.rarity === crew.max_rarity) && (crew.level === 100);
        const notOwned = (crew) => {
            let rc = STTApi.roster.find((rosterCrew) => rosterCrew.symbol === crew.symbol);
            return !(rc) || !isFFFE(rc);
        }

        // Let's combine allcrew with roster such that FFFE crew shows up only once
        return STTApi.roster.concat(STTApi.allcrew.filter(crew => notOwned(crew)));
    }

    _updateCommandItems() {
        if (this.props.onCommandItemsUpdate) {
            this.props.onCommandItemsUpdate([
                {
                    key: 'export',
                    text: 'Export',
                    iconProps: { iconName: 'Download' },
                    subMenuProps: {
                        items: [
                            {
                                key: 'exportExcel',
                                name: 'Export Excel...',
                                iconProps: { iconName: 'ExcelLogo' },
                                onClick: async () => {
                                    let data = await exportExcel(STTApi.playerData.character.items);
                                    download('My Crew.xlsx', data, 'Export Star Trek Timelines crew roster', 'Export');
                                }
                            },
                            {
                                key: 'exportCsv',
                                name: 'Export CSV...',
                                iconProps: { iconName: 'ExcelDocument' },
                                onClick: () => {
                                    let csv = exportCsv();
                                    download('My Crew.csv', csv, 'Export Star Trek Timelines crew roster', 'Export');
                                }
                            },
                            {
                                key: 'share',
                                name: 'Share...',
                                iconProps: { iconName: 'Share' },
                                onClick: () => { this.refs.shareDialog._showDialog(STTApi.playerData.character.display_name); }
                            }]
                        }
                },
                {
                    key: 'settings',
                    text: 'Settings',
                    iconProps: { iconName: 'Equalizer' },
                    subMenuProps: {
                        items: [{
                            key: 'showEveryone',
                            text: '(EXPERIMENTAL) Show stats for all crew',
                            canCheck: true,
                            isChecked: this.state.showEveryone,
                            onClick: () => {
                                let isChecked = !this.state.showEveryone;
                                this.setState({
                                    crewData: this.loadCrewData(isChecked),
                                    showEveryone: isChecked
                                }, () => { this._updateCommandItems(); });
                            }
                        }]
                    }
                }
            ]);
        }
    }

	render() {
		return <div>
            <SearchBox placeholder='Search by name or trait...'
                onChange={(newValue) => this.refs.crewList.filter(newValue)}
                onSearch={(newValue) => this.refs.crewList.filter(newValue)}
            />
            <CrewList data={this.state.crewData} ref='crewList' />
            <ShareDialog ref='shareDialog' onShare={shareCrew} />
        </div>;
	}
}