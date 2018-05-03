import XlsxPopulate from 'xlsx-populate';
import STTApi from 'sttapi';

export function exportExcel(itemList, fileName) {
	return XlsxPopulate.fromBlankAsync().then(workbook => {
		var worksheet = workbook.addSheet('Crew stats');

		worksheet.column(1).width(5);
		worksheet.column(2).width(28);
		worksheet.column(3).width(14);
		worksheet.column(4).width(8);
		worksheet.column(5).width(12);
		worksheet.column(6).width(7);
		worksheet.column(7).width(8);
		worksheet.column(8).width(24);
		worksheet.column(9).width(8);
		worksheet.column(10).width(8);
		worksheet.column(11).width(24);
		worksheet.column(12).width(8);
		worksheet.column(13).width(8);
		worksheet.column(14).width(24);
		worksheet.column(15).width(8);
		worksheet.column(16).width(8);
		worksheet.column(17).width(24);
		worksheet.column(18).width(8);
		worksheet.column(19).width(8);
		worksheet.column(20).width(24);
		worksheet.column(21).width(8);
		worksheet.column(22).width(8);
		worksheet.column(23).width(24);
		worksheet.column(24).width(8);
		worksheet.column(25).width(8);
		worksheet.column(26).width(10);
		worksheet.column(26).hidden(true);
		worksheet.column(27).width(40);

		worksheet.row(1).style("bold", true);

		//worksheet.autoFilter = 'A1:AA1';

		let values = [];
		values.push(['id', 'name', 'short_name', 'rarity', 'max_rarity', 'level', 'frozen',
'command_skill.core', 'command_skill.min', 'command_skill.max', 'diplomacy_skill.core', 'diplomacy_skill.min', 'diplomacy_skill.max',
'science_skill.core', 'science_skill.min', 'science_skill.max', 'security_skill.core', 'security_skill.min', 'security_skill.max',
'engineering_skill.core', 'engineering_skill.min', 'engineering_skill.max', 'medicine_skill.core', 'medicine_skill.min', 'medicine_skill.max',
'buyback', 'traits']);

		STTApi.roster.forEach(function (crew) {
			values.push([crew.id, crew.name, crew.short_name, crew.rarity, crew.max_rarity, crew.level, crew.frozen,
				crew.command_skill.core, crew.command_skill.min, crew.command_skill.max, crew.diplomacy_skill.core, crew.diplomacy_skill.min, crew.diplomacy_skill.max,
				crew.science_skill.core, crew.science_skill.min, crew.science_skill.max, crew.security_skill.core, crew.security_skill.min, crew.security_skill.max,
				crew.engineering_skill.core, crew.engineering_skill.min, crew.engineering_skill.max, crew.medicine_skill.core, crew.medicine_skill.min, crew.medicine_skill.max,
				crew.buyback, crew.traits]);
		});

		worksheet.cell("A1").value(values);

		var worksheetItems = workbook.addSheet('Item stats');

		worksheetItems.column(1).width(5);
		worksheetItems.column(2).width(42);
		worksheetItems.column(3).width(10);
		worksheetItems.column(4).width(10);
		worksheetItems.column(5).width(14);
		worksheetItems.column(6).width(58);
		worksheetItems.column(7).width(70);

		values = [];
		values.push(['id', 'name', 'quantity', 'rarity', 'type', 'symbol', 'details']);

		worksheetItems.row(1).style("bold", true);

		//worksheetItems.autoFilter = 'A1:G1';

		itemList.forEach(function (item) {
			values.push([item.archetype_id, item.name, item.quantity, item.rarity,
				item.icon.file.replace("/items", "").split("/")[1], item.icon.file.replace("/items", "").split("/")[2], item.flavor]);
		});

		worksheetItems.cell("A1").value(values);

		var worksheetShips = workbook.addSheet('Ship stats');

		worksheetShips.column(1).width(5);
		worksheetShips.column(2).width(30);
		worksheetShips.column(3).width(12);
		worksheetShips.column(4).width(12);
		worksheetShips.column(5).width(8);
		worksheetShips.column(6).width(10);
		worksheetShips.column(7).width(10);
		worksheetShips.column(8).width(10);
		worksheetShips.column(9).width(10);
		worksheetShips.column(10).width(10);

		values = [];
		values.push(['id', 'name', 'level', 'max_level', 'rarity', 'shields', 'hull', 'attack', 'accuracy', 'evasion']);

		worksheetShips.row(1).style("bold", true);

		//worksheetShips.autoFilter = 'A1:J1';

		STTApi.ships.forEach(function (ship) {
			values.push([ship.archetype_id, ship.name, ship.level, ship.max_level, ship.rarity, ship.shields, ship.hull, ship.attack, ship.accuracy, ship.evasion]);
		});

		worksheetShips.cell("A1").value(values);

		return workbook.toFileAsync(fileName).then(() => Promise.resolve(fileName));
	});
}