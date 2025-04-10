/*
 * This program is copyright © 2008-2013 Eric Bishop and is distributed under the terms of the GNU GPL
 * version 2.0 with a special clarification/exception that permits adapting the program to
 * configure proprietary "back end" software provided that all modifications to the web interface
 * itself remain covered by the GPL.
 * See http://gargoyle-router.com/faq.html#qfoss for more information
 */

var webmS=new Object(); //part of i18n

var updateInProgress;
var timeSinceUpdate;
var webmonUpdater = null;


function saveChanges()
{
	if(updateInProgress)
	{
		return;
	}
	updateInProgress = true;

	errorList = proofreadAll();
	if(errorList.length > 0)
	{
		updateInProgress = false;
		errorString = errorList.join("\n") + "\n\n"+UI.ErrChanges;
		alert(errorString);
	}
	else
	{
		setControlsEnabled(false, true);
		if(webmonUpdater != null)
		{
			clearInterval(webmonUpdater);
		}


		var enabled = document.getElementById("webmon_enabled").checked ;
		var enabledCommand = "/etc/init.d/webmon_gargoyle " + (enabled ? "enable" : "disable") + "\n";
		var startStopCommand = "/etc/init.d/webmon_gargoyle stop";
		uci = uciOriginal.clone();
		uci.set("webmon_gargoyle", "webmon", "enabled", (enabled ? "1" : "0"));
		if(enabled)
		{
			uci.set("webmon_gargoyle", "webmon", "max_domains",  document.getElementById("num_domains").value );
			uci.set("webmon_gargoyle", "webmon", "max_searches", document.getElementById("num_searches").value );

			var ipTable = document.getElementById('ip_table_container').firstChild;
			var ipArrayList = getTableDataArray(ipTable, true, false);
			var ipList = [];
			var ipi;
			for(ipi = 0; ipi < ipArrayList.length; ipi++)
			{
				ipList.push( (ipArrayList[ipi][0]).replace(/[\t ]+/,"") );
			}


			uci.remove("webmon_gargoyle", "webmon", "include_ips");
			uci.remove("webmon_gargoyle", "webmon", "exclude_ips");
			var include_exclude_type = getSelectedValue("include_exclude");
			if(include_exclude_type == "exclude" && ipList.length > 0)
			{
				uci.set("webmon_gargoyle", "webmon", "exclude_ips", ipList.join(","));
			}
			else if(include_exclude_type == "include" && ipList.length > 0)
			{
				uci.set("webmon_gargoyle", "webmon", "include_ips", ipList.join(","));
			}

			var ipTable = document.getElementById('ip6_table_container').firstChild;
			var ipArrayList = getTableDataArray(ipTable, true, false);
			var ipList = [];
			var ipi;
			for(ipi = 0; ipi < ipArrayList.length; ipi++)
			{
				ipList.push( (ipArrayList[ipi][0]).replace(/[\t ]+/,"") );
			}


			uci.remove("webmon_gargoyle", "webmon", "include_ip6s");
			uci.remove("webmon_gargoyle", "webmon", "exclude_ip6s");
			var include_exclude_type = getSelectedValue("include_exclude");
			if(include_exclude_type == "exclude" && ipList.length > 0)
			{
				uci.set("webmon_gargoyle", "webmon", "exclude_ip6s", ipList.join(","));
			}
			else if(include_exclude_type == "include" && ipList.length > 0)
			{
				uci.set("webmon_gargoyle", "webmon", "include_ip6s", ipList.join(","));
			}
			startStopCommand = "/etc/init.d/webmon_gargoyle restart\n";
		}





		commands = uci.getScriptCommands(uciOriginal) + "\n" + enabledCommand  + startStopCommand;
		//document.getElementById("output").value = commands;


		var param = getParameterDefinition("commands", commands) + "&" + getParameterDefinition("hash", document.cookie.replace(/^.*hash=/,"").replace(/[\t ;]+.*$/, ""));
		var stateChangeFunction = function(req)
		{
			if(req.readyState == 4)
			{
				webmonEnabled = document.getElementById("webmon_enabled").checked;
				includeData = [];
				excludeData = [];
				var ipTable = document.getElementById('ip_table_container').firstChild;

				uciOriginal = uci.clone();

				setControlsEnabled(true);
				updateInProgress = false;
				if(webmonEnabled)
				{
					updateMonitorTable();
				}
				resetData();
				//alert(req.responseText);
			}
		}
		runAjax("POST", "utility/run_commands.sh", param, stateChangeFunction);
	}
}

function clearHistory()
{
	var confirmClear = window.confirm(UI.Clear+"?");
	if(!confirmClear)
	{
		return;
	}

	if(updateInProgress)
	{
		return;
	}
	updateInProgress = true;
	setControlsEnabled(false, true);

	var domainFile = uciOriginal.get("webmon_gargoyle", "webmon", "domain_save_path");
	var searchFile = uciOriginal.get("webmon_gargoyle", "webmon", "search_save_path");
	var commands = "/etc/init.d/webmon_gargoyle stop\nrm -rf " + domainFile + " 2>/dev/null ; rm -rf " + searchFile + " 2>/dev/null";
	if(webmonEnabled)
	{
		commands = commands +  "\n/etc/init.d/webmon_gargoyle start";
	}

	var stateChangeFunction = function(req)
	{
		if(req.readyState == 4)
		{
			setControlsEnabled(true);
			updateInProgress = false;

			var containerNames = ["webmon_domain_table_container", "webmon_search_table_container"];
			var ci;
			for(ci=0; ci < containerNames.length; ci++)
			{
				tableContainer = document.getElementById(containerNames[ci]);
				if(tableContainer.firstChild != null)
				{
					tableContainer.removeChild(tableContainer.firstChild);
				}
			}

			setElementEnabled(document.getElementById("domain_host_display"), webmonEnabled);
			setElementEnabled(document.getElementById("search_host_display"), webmonEnabled);
			if(webmonEnabled)
			{
				updateMonitorTable();
			}
		}
	}
	var param = getParameterDefinition("commands", commands) + "&" + getParameterDefinition("hash", document.cookie.replace(/^.*hash=/,"").replace(/[\t ;]+.*$/, ""));
	runAjax("POST", "utility/run_commands.sh", param, stateChangeFunction);
}


function proofreadAll()
{
	var validator = function(n){ return validateNumericRange(n,1,9999); };
	return proofreadFields( ["num_domains", "num_searches"], ["num_domains_label", "num_searches_label"], [validator, validator], [0,0], ["num_domains_label", "num_searches_label"]);
}


function getHostDisplay(ip, hostDisplayType)
{
	var host = ip;
	if(hostDisplayType == "hostname" && ipToHostname[ip] != null)
	{
		host = ipToHostname[ip];
		host = host.length < 25 ? host : host.substr(0,22)+"...";
	}
	return host;
}


function resetData()
{
	document.getElementById("webmon_enabled").checked = webmonEnabled;

	var numDomains  = uciOriginal.get("webmon_gargoyle", "webmon", "max_domains");
	var numSearches = uciOriginal.get("webmon_gargoyle", "webmon", "max_searches");
	document.getElementById("num_domains").value  = numDomains == ""  ? 300 : numDomains;
	document.getElementById("num_searches").value = numSearches == "" ? 300 : numSearches;

	var ips = [];
	var ip6s = [];
	if(uciOriginal.get("webmon_gargoyle", "webmon", "exclude_ips") != "")
	{
		ips = (uciOriginal.get("webmon_gargoyle", "webmon", "exclude_ips")).split(/,/);
		ip6s = (uciOriginal.get("webmon_gargoyle", "webmon", "exclude_ip6s")).split(/,/);
		setSelectedValue("include_exclude", "exclude");
	}
	else if(uciOriginal.get("webmon_gargoyle", "webmon", "include_ips") != "")
	{
		ips = (uciOriginal.get("webmon_gargoyle", "webmon", "include_ips")).split(/,/);
		ip6s = (uciOriginal.get("webmon_gargoyle", "webmon", "include_ip6s")).split(/,/);
		setSelectedValue("include_exclude", "include");
	}
	else
	{
		setSelectedValue("include_exclude", "all");
	}

	var ipTableData = [];
	while(ips.length > 0)
	{
		ipTableData.push( [ ips.shift() ] );
	}
	var ip6TableData = [];
	while(ip6s.length > 0)
	{
		ip6TableData.push( [ ip6s.shift() ] );
	}


	var ipTable=createTable([""], ipTableData, "ip_table", true, false);
	var tableContainer = document.getElementById('ip_table_container');
	if(tableContainer.firstChild != null)
	{
		tableContainer.removeChild(tableContainer.firstChild);
	}
	tableContainer.appendChild(ipTable);

	var ip6Table=createTable([""], ip6TableData, "ip6_table", true, false);
	var tableContainer = document.getElementById('ip6_table_container');
	if(tableContainer.firstChild != null)
	{
		tableContainer.removeChild(tableContainer.firstChild);
	}
	tableContainer.appendChild(ip6Table);


	setIncludeExclude();
	setWebmonEnabled();

	var containerNames = ["webmon_domain_table_container", "webmon_search_table_container"];
	var ci;
	for(ci=0; ci < containerNames.length; ci++)
	{
		tableContainer = document.getElementById(containerNames[ci]);
		if(tableContainer.firstChild != null)
		{
			tableContainer.removeChild(tableContainer.firstChild);
		}
	}


	if(webmonEnabled)
	{
		updateMonitorTable();
		if(webmonUpdater != null)
		{
			clearInterval(webmonUpdater);
		}
		webmonUpdater = setInterval("updateMonitorTable()", 10000); //check for updates every 10 seconds

	}
	setElementEnabled(document.getElementById("domain_host_display"), webmonEnabled);
	setElementEnabled(document.getElementById("search_host_display"), webmonEnabled);
	setElementEnabled(document.getElementById("download_domain_button"), webmonEnabled);
	setElementEnabled(document.getElementById("download_search_button"), webmonEnabled);
}

function setIncludeExclude()
{
	document.getElementById("add_ip_container").style.display = (getSelectedValue("include_exclude")=="all") ? "none" : "block";
	document.getElementById("add_ip6_container").style.display = (getSelectedValue("include_exclude")=="all") ? "none" : "block";
}

function setWebmonEnabled()
{
	var enabled = document.getElementById("webmon_enabled").checked;
	var ids=[ 'num_domains', 'num_searches', 'include_exclude', 'add_ip', 'add_ip6'];
	for (idIndex in ids)
	{
		element = document.getElementById(ids[idIndex]);
		element.disabled= !enabled;
		element.readonly= !enabled;
		element.style.color = !enabled ? "#AAAAAA" : "#000000";
	}
	var addButton = document.getElementById('add_ip_button');
	setElementEnabled(addButton, enabled);
	var addButton = document.getElementById('add_ip6_button');
	setElementEnabled(addButton, enabled);

	addIpTable = document.getElementById('ip_table_container').firstChild;
	if(addIpTable != null)
	{
		setRowClasses(addIpTable, enabled);
	}
	addIp6Table = document.getElementById('ip6_table_container').firstChild;
	if(addIp6Table != null)
	{
		setRowClasses(addIp6Table, enabled);
	}
}



function updateMonitorTable()
{
	if(!updateInProgress)
	{
		updateInProgress = true;
		var commands="echo domains ; cat /proc/webmon_recent_domains 2>/dev/null; echo searches ; cat /proc/webmon_recent_searches 2>/dev/null ; echo webmon_done";
		var param = getParameterDefinition("commands", commands) + "&" + getParameterDefinition("hash", document.cookie.replace(/^.*hash=/,"").replace(/[\t ;]+.*$/, ""));
		var stateChangeFunction = function(req)
		{
			if(req.readyState == 4)
			{
				var tableData = [];
				var webmonLines = req.responseText.split(/[\n\r]+/);
				var loadedData = (webmonLines != null);
				if(loadedData)
				{
					var domainData = [];
					var searchData = [];
					var type = "domains";
					var hostDisplayType = getSelectedValue("domain_host_display");

					var wmIndex=0;
					while(webmonLines[wmIndex] != "domains" && wmIndex < webmonLines.length ){ wmIndex++; }
					for(wmIndex++; loadedData && webmonLines[wmIndex] !=  "webmon_done" && wmIndex <  webmonLines.length; wmIndex++)
					{
						if(webmonLines[wmIndex] == "searches")
						{
							type = "searches";
							hostDisplayType = getSelectedValue("search_host_display");
						}
						else
						{
							var splitLine = webmonLines[wmIndex].split(/[\t]+/);
							if(!splitLine || splitLine.length < 4) continue;
							loadedData = loadedData && parseInt(splitLine[0]) != "NaN";
							var lastVisitDate = new Date();
							lastVisitDate.setTime( 1000*parseInt(splitLine[0]) );

							var systemDateFormat = uciOriginal.get("gargoyle",  "global", "dateformat");
							var twod = function(num) { var nstr = "" + num; nstr = nstr.length == 1 ? "0" + nstr : nstr; return nstr; }
							var m = twod(lastVisitDate.getMonth()+1);
							var d = twod(lastVisitDate.getDate());
							var h = " " + lastVisitDate.getHours() + ":" +  twod(lastVisitDate.getMinutes())  + ":" + twod(lastVisitDate.getSeconds());
							var lastVisit = (systemDateFormat == "" || systemDateFormat == "usa" || systemDateFormat == "iso") ? m + "/" + d + h : d + "/" + m + h;
							lastVisit = systemDateFormat == "russia" ? d + "." + m + h : lastVisit;
							lastVisit = systemDateFormat == "hungary" ? m + "." + d + h : lastVisit;
							lastVisit = systemDateFormat == "iso8601" ? m + "-" + d + h : lastVisit;

							var ip = splitLine[2];
							ip = isIPv6(ip) ? ip6_canonical(ip) : ip;
							var host = getHostDisplay(ip, hostDisplayType);
							var value = splitLine[3];

							if(type == "domains")
							{
								var domainLink = document.createElement("a");
								domainLink.setAttribute('href',"http://" + value);
								var domainText = value;
								if(domainText.length > 43)
								{
									domainText = domainText.substr(0, 40) + "...";
								}
								domainLink.appendChild( document.createTextNode(domainText) );
								domainData.push([host, lastVisit, domainLink]);
							}
							else
							{
								var searchText = value.replace(/\+/g, " ");
								if(searchText.length > 43)
								{
									searchText = searchText.substr(0, 40) + "...";
								}
								searchData.push([host, lastVisit, searchText]);
							}
						}
					}
				}

				//loadedData = loadedData && (webmonLines[webmonLines.length -1].match(/^Success/) != null);
				if(loadedData)
				{
					var domainColumns=webmS.dCol;
					var searchColumns=webmS.sCol;
					var domainTable = createTable(domainColumns, domainData, "webmon_domain_table", false, false);
					var searchTable = createTable(searchColumns, searchData, "webmon_search_table", false, false);

					var containerNames = ["webmon_domain_table_container", "webmon_search_table_container"];
					var ci;
					for(ci=0; ci < containerNames.length; ci++)
					{
						tableContainer = document.getElementById(containerNames[ci]);
						if(tableContainer.firstChild != null)
						{
							tableContainer.removeChild(tableContainer.firstChild);
						}
						tableContainer.appendChild(  (containerNames[ci]).match(/domain/) != null ? domainTable : searchTable  );
					}
				}
				updateInProgress = false;
			}
		}
		runAjax("POST", "utility/run_commands.sh", param, stateChangeFunction);
	}
}

function webmonSearch(input, container)
{
	const table = container.getElementsByTagName('table')[0];
	if (!table) return;

	// The 'table-striped' used to highlight odd/even rows using CSS
	// Unfortunately, this cannot be used if some rows are hidden
	// So removing the class and later assign odd/even classes directly to the rows
	table.classList.remove('table-striped');

	const tbody = table.getElementsByTagName('tbody')[0];
	if (!tbody) return;

	const s = input.value.trim();
	if (s == '')
	{
		for (let i = 0, k = tbody.rows.length; i < k; ++i)
		{
			tbody.rows[i].style.display = ''; // 'table-row' can also be used
			tbody.rows[i].className = i % 2 ? 'even' : 'odd';
		}
	}
	else
	{
		const S = s.toUpperCase();
		let visibleIndex = 0;
		for (let i = 0, k = tbody.rows.length; i < k; ++i)
		{
			const row = tbody.rows[i];
			let host = row.dataset.host;
			if(host == null)
			{
				// Caching host/ip in dataset
				host = row.cells[0] && row.cells[0].firstChild ? row.cells[0].firstChild.nodeValue.toUpperCase() : '';
				row.dataset.host = host;
			}
			let value = row.dataset.value;
			if(value == null)
			{
				// Caching value (domain/search) in dataset
				value = row.cells[2] && row.cells[2].firstChild ? row.cells[2].firstChild.getAttribute('href') : '';
				const proto = value.indexOf('://');
				if(proto > 0) value = value.slice(proto + 3).toUpperCase();
				row.dataset.value = value;
			}
			if(host.indexOf(S) >= 0 || value.indexOf(S) >= 0)
			{
				row.style.display = ''; // 'table-row' can also be used
				row.className = visibleIndex++ % 2 ? 'even' : 'odd';
			}
			else
			{
				row.style.display = 'none';
			}
		}
	}
}

var webmonSearchTimer;
function webmonSearchInit(inputId, containerId)
{
	const input = byId(inputId);
	if(!input) return;

	const container = byId(containerId);
	if(!container){
		// No container for the table exists -- hide filter input
		input.style.display='none';
		return;
	}

	input.addEventListener('keyup', function(evt) {
		clearTimeout(webmonSearchTimer);
		webmonSearchTimer = setTimeout(webmonSearch, 1000, input, container);
	}, false);

	const observer = new MutationObserver(function(mutationList, observer) {
		if(input.value.trim() == '') return;
		for (const mutation of mutationList)
		{
			if (mutation.type === 'childList' && mutation.addedNodes)
			{
				// New table added, re-filtering
				webmonSearch(input, container);
				break;
			}
		}
	});

	observer.observe(container, { childList: true });
}
