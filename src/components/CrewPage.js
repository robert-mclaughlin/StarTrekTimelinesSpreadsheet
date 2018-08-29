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
    }
    
    componentDidMount() {
        this.refs.crewList.filter('');

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
                            }]
                        }
                },
                {
                    key: 'share',
                    name: 'Share',
                    iconProps: { iconName: 'Share' },
                    onClick: () => { this.refs.shareDialog._showDialog(STTApi.playerData.character.display_name); }
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
            <CrewList data={STTApi.roster} ref='crewList' />
            <ShareDialog ref='shareDialog' onShare={shareCrew} />
        </div>;
	}
}