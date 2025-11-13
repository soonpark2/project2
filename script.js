// ========== 전역 변수 ==========

let csvData = [];
let csvData2 = []; // DB2 데이터용 (평년탭)
let filteredData = [];
let currentFilters = {
    region: '전국',
    cropGroup: '',
    crop: '',
    year: '2023'
};
let compareFilters = {
    cropGroup: '',
    crop: '',
    year: '2023'
};
let yearlyFilters = { // 평년탭용 필터
    comparisonMode: 'gangwon-yearly-vs-current',
    cropGroup: '',
    crop: ''
};
let charts = {};
let currentTab = 'home';

// ========== CSV 데이터 로딩 ==========

async function loadCSVFromGitHub() {
    try {
        const csvUrl = 'https://raw.githubusercontent.com/soonpark2/project1/main/DB.csv';
        const response = await fetch(csvUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const csvText = await response.text();
        console.log('CSV 데이터 로드 성공:', csvText.substring(0, 200) + '...');
        parseCSV(csvText);
    } catch (error) {
        console.error('CSV 파일 로드 오류:', error);
        showError(`GitHub에서 CSV 파일을 불러올 수 없습니다: ${error.message}`);
    }
}

function showError(message) {
    console.error(message);
    const tableBody = document.getElementById('detailTableBody');
    if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="2" style="text-align: center; color: #ef4444; padding: 2rem;">${message}</td></tr>`;
    }
}

function parseCSV(csvText) {
    console.log('CSV 파싱 시작...');
    Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            console.log('파싱 결과:', results);
            
            if (results.errors && results.errors.length > 0) {
                console.error('파싱 에러:', results.errors);
            }
            
            csvData = results.data.map(row => ({
                region: (row['지역구분'] || '').trim(),
                year: (row['년'] || '').trim(),
                cropGroup: (row['작목군'] || '').trim(),
                crop: (row['작목'] || '').trim(),
                category: (row['구분'] || '').trim(),
                value: parseFloat((row['값'] || '0').toString().replace(/,/g, '')) || 0
            })).filter(row => row.region && row.cropGroup);
            
            console.log('파싱된 데이터:', csvData.slice(0, 5));
            console.log('총 데이터 수:', csvData.length);
            
            // kg당 관련 카테고리 확인
            const kgCategories = csvData.filter(item => item.category && item.category.includes('kg')).map(item => item.category);
            const uniqueKgCategories = [...new Set(kgCategories)];
            console.log('kg 관련 카테고리들:', uniqueKgCategories);
            
            // 전체 카테고리 목록 확인
            const allCategories = [...new Set(csvData.map(item => item.category))].sort();
            console.log('전체 카테고리 목록:', allCategories);
            
            if (csvData.length > 0) {
                initializeFilters();
                initializeCompareFilters();
                initializeSummaryFilters();
                updateDisplay();
            } else {
                showError('유효한 데이터가 없습니다.');
            }
        },
        error: function(error) {
            console.error('Papa Parse 에러:', error);
            showError('CSV 파싱 중 오류가 발생했습니다.');
        }
    });
}

// DB2 로딩 함수 (평년탭용)
async function loadCSV2FromGitHub() {
    try {
        const csvUrl2 = 'https://raw.githubusercontent.com/soonpark2/project1/main/DB2.csv';
        const response = await fetch(csvUrl2);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const csvText = await response.text();
        console.log('DB2 CSV 다운로드 완료, 크기:', csvText.length);
        
        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                console.log('DB2 파싱 완료, 행 수:', results.data.length);
                
                if (results.errors && results.errors.length > 0) {
                    console.error('DB2 파싱 에러:', results.errors);
                }
                
                csvData2 = results.data.map(row => ({
                    region: (row['지역구분'] || '').trim(),
                    cropGroup: (row['작목군'] || '').trim(),
                    crop: (row['작목'] || '').trim(),
                    category: (row['구분'] || '').trim(),
                    value: parseFloat((row['값'] || '0').toString().replace(/,/g, '')) || 0
                })).filter(row => row.region && row.cropGroup);
                
                console.log('DB2 파싱된 데이터:', csvData2.slice(0, 5));
                console.log('DB2 총 데이터 수:', csvData2.length);
                
                // 평년탭 필터 초기화는 탭이 활성화될 때 수행
                if (currentTab === 'yearly') {
                    initializeYearlyFilters();
                }
            },
            error: function(error) {
                console.error('DB2 Papa Parse 에러:', error);
                showError('DB2 CSV 파싱 중 오류가 발생했습니다.');
            }
        });
    } catch (error) {
        console.error('DB2 로딩 에러:', error);
        showError('DB2 데이터를 불러올 수 없습니다.');
    }
}

// ========== 필터 초기화 및 관리 ==========

function initializeFilters() {
    console.log('필터 초기화 중...');
    
    // 지역 필터 초기화
    const regions = [...new Set(csvData.map(item => item.region))].sort();
    const regionFilter = document.getElementById('regionFilter');
    if (regionFilter) {
        regionFilter.innerHTML = '';
        regions.forEach((region, index) => {
            const isActive = index === 0;
            regionFilter.innerHTML += `<div class="filter-item ${isActive ? 'active' : ''}" data-region="${region}">${region}</div>`;
            if (isActive) {
                currentFilters.region = region;
            }
        });
    }
    
    // 작목군 필터 초기화
    const cropGroups = [...new Set(csvData.map(item => item.cropGroup).filter(group => group && group.trim() !== ''))].sort();
    console.log('작목군 데이터:', cropGroups);
    const cropGroupFilter = document.getElementById('statusCropGroupFilter');
    if (cropGroupFilter) {
        console.log('작목군 필터 요소 찾음:', cropGroupFilter);
        cropGroupFilter.innerHTML = '';
        cropGroups.forEach((group, index) => {
            const isActive = index === 0;
            cropGroupFilter.innerHTML += `<div class="filter-item ${isActive ? 'active' : ''}" data-crop-group="${group}">${group}</div>`;
            if (isActive) {
                currentFilters.cropGroup = group;
            }
        });
        console.log('작목군 필터 HTML:', cropGroupFilter.innerHTML);
    } else {
        console.log('작목군 필터 요소를 찾을 수 없음');
    }

    // 연도 필터 초기화
    const years = [...new Set(csvData.map(item => item.year))].sort().reverse();
    const yearFilter = document.getElementById('yearFilter');
    if (yearFilter) {
        yearFilter.innerHTML = '';
        years.forEach((year, index) => {
            const isActive = index === 0;
            yearFilter.innerHTML += `<div class="year-btn ${isActive ? 'active' : ''}" data-year="${year}">${year}</div>`;
            if (isActive) {
                currentFilters.year = year;
            }
        });
    }

    updateCrops();
    attachFilterEvents();
}

// 비교 탭용 필터 초기화
function initializeCompareFilters() {
    console.log('비교 탭 필터 초기화 중...');
    
    // 작목군 필터 초기화 (선택된 연도에서 전국과 강원 공통 작목군만)
    const selectedYear = compareFilters.year || '2023';
    const nationalCropGroups = new Set(csvData.filter(item => item.region === '전국' && item.year === selectedYear).map(item => item.cropGroup));
    const gangwonCropGroups = new Set(csvData.filter(item => item.region === '강원' && item.year === selectedYear).map(item => item.cropGroup));
    const commonCropGroups = [...nationalCropGroups].filter(group => gangwonCropGroups.has(group)).sort();
    
    const compareCropGroupFilter = document.getElementById('compareCropGroupFilter');
    if (compareCropGroupFilter) {
        compareCropGroupFilter.innerHTML = '';
        commonCropGroups.forEach((group, index) => {
            const isActive = index === 0;
            compareCropGroupFilter.innerHTML += `<div class="filter-item ${isActive ? 'active' : ''}" data-crop-group="${group}">${group}</div>`;
            if (isActive) {
                compareFilters.cropGroup = group;
            }
        });
    }
    
    // income-table용 드롭다운도 초기화
    const compareIncomeCropGroupFilter = document.getElementById('compareIncomeCropGroupFilter');
    if (compareIncomeCropGroupFilter) {
        compareIncomeCropGroupFilter.innerHTML = '<option value="all">전체 작목군</option>';
        commonCropGroups.forEach(group => {
            compareIncomeCropGroupFilter.innerHTML += `<option value="${group}">${group}</option>`;
        });
    }

    // 연도 필터 초기화
    const years = [...new Set(csvData.map(item => item.year))].sort().reverse();
    const compareYearFilter = document.getElementById('compareYearFilter');
    if (compareYearFilter) {
        compareYearFilter.innerHTML = '';
        years.forEach((year, index) => {
            const isActive = index === 0;
            compareYearFilter.innerHTML += `<div class="year-btn ${isActive ? 'active' : ''}" data-year="${year}">${year}</div>`;
            if (isActive) {
                compareFilters.year = year;
            }
        });
    }

    updateCompareCrops();
    attachCompareFilterEvents();
}

function updateCompareCrops() {
    // 선택된 연도와 작목군에서 전국과 강원 둘 다에 공통으로 있는 작목상세만 표시
    const selectedYear = compareFilters.year || '2023';
    const nationalCrops = new Set(
        csvData.filter(item => item.region === '전국' && 
                      item.year === selectedYear &&
                      (!compareFilters.cropGroup || item.cropGroup === compareFilters.cropGroup))
             .map(item => item.crop)
    );
    const gangwonCrops = new Set(
        csvData.filter(item => item.region === '강원' && 
                      item.year === selectedYear &&
                      (!compareFilters.cropGroup || item.cropGroup === compareFilters.cropGroup))
             .map(item => item.crop)
    );
    
    const commonCrops = [...nationalCrops].filter(crop => gangwonCrops.has(crop)).sort();
    
    const compareCropFilter = document.getElementById('compareCropFilter');
    if (compareCropFilter) {
        compareCropFilter.innerHTML = '';
        commonCrops.forEach((crop, index) => {
            const isActive = index === 0;
            compareCropFilter.innerHTML += `<div class="filter-item ${isActive ? 'active' : ''}" data-crop="${crop}">${crop}</div>`;
            if (isActive) {
                compareFilters.crop = crop;
            }
        });
    }
}

function attachCompareFilterEvents() {
    // 비교 작목군 필터
    document.addEventListener('click', function(e) {
        if (e.target.matches('#compareCropGroupFilter .filter-item')) {
            document.querySelectorAll('#compareCropGroupFilter .filter-item').forEach(i => i.classList.remove('active'));
            e.target.classList.add('active');
            compareFilters.cropGroup = e.target.dataset.cropGroup;
            compareFilters.crop = '';
            updateCompareCrops();
            if (currentTab === 'compare') updateCompareDisplay();
        }
    });

    // 비교 작목 필터
    document.addEventListener('click', function(e) {
        if (e.target.matches('#compareCropFilter .filter-item')) {
            console.log('작목 필터 클릭됨:', e.target.dataset.crop, '현재탭:', currentTab);
            document.querySelectorAll('#compareCropFilter .filter-item').forEach(i => i.classList.remove('active'));
            e.target.classList.add('active');
            compareFilters.crop = e.target.dataset.crop;
            console.log('작목 필터 변경:', compareFilters.crop, '전체 필터:', compareFilters);
            
            // currentTab 확인 로직을 더 안전하게
            const isCompareTab = (currentTab === 'compare' || window.currentTab === 'compare');
            console.log('탭 확인:', currentTab, window.currentTab, '비교탭인가?', isCompareTab);
            
            if (isCompareTab) {
                console.log('비교탭에서 차트 업데이트 시작');
                updateCompareDisplay();
            } else {
                console.log('비교탭이 아니어서 업데이트 안함');
            }
        }
    });

    // 비교 연도 필터
    document.addEventListener('click', function(e) {
        if (e.target.matches('#compareYearFilter .year-btn')) {
            document.querySelectorAll('#compareYearFilter .year-btn').forEach(i => i.classList.remove('active'));
            e.target.classList.add('active');
            compareFilters.year = e.target.dataset.year;
            compareFilters.cropGroup = '';
            updateCompareCropGroups();
            updateCompareCrops();
            if (currentTab === 'compare') updateCompareDisplay();
        }
    });
}

// 비교탭 작목군 업데이트 함수 추가
function updateCompareCropGroups() {
    const selectedYear = compareFilters.year || '2023';
    const nationalCropGroups = new Set(csvData.filter(item => item.region === '전국' && item.year === selectedYear).map(item => item.cropGroup));
    const gangwonCropGroups = new Set(csvData.filter(item => item.region === '강원' && item.year === selectedYear).map(item => item.cropGroup));
    const commonCropGroups = [...nationalCropGroups].filter(group => gangwonCropGroups.has(group)).sort();
    
    // 사이드바 작목군 필터 업데이트
    const compareCropGroupFilter = document.getElementById('compareCropGroupFilter');
    if (compareCropGroupFilter) {
        compareCropGroupFilter.innerHTML = '';
        commonCropGroups.forEach(group => {
            compareCropGroupFilter.innerHTML += `<div class="filter-item" data-crop-group="${group}">${group}</div>`;
        });
    }
    
    // income-table용 드롭다운 업데이트
    const compareIncomeCropGroupFilter = document.getElementById('compareIncomeCropGroupFilter');
    if (compareIncomeCropGroupFilter) {
        compareIncomeCropGroupFilter.innerHTML = '<option value="all">전체 작목군</option>';
        commonCropGroups.forEach(group => {
            compareIncomeCropGroupFilter.innerHTML += `<option value="${group}">${group}</option>`;
        });
    }
}

function updateCrops() {
    let filtered = csvData.filter(item => 
        item.region === currentFilters.region &&
        item.year === currentFilters.year
    );
    
    if (currentFilters.cropGroup) {
        filtered = filtered.filter(item => item.cropGroup === currentFilters.cropGroup);
    }
    
    const crops = [...new Set(filtered.map(item => item.crop))].sort();
    const cropFilter = document.getElementById('cropFilter');
    if (cropFilter) {
        cropFilter.innerHTML = '';
        crops.forEach(crop => {
            cropFilter.innerHTML += `<div class="filter-item" data-crop="${crop}">${crop}</div>`;
        });
        // 첫 번째 항목을 기본 선택으로 설정
        if (crops.length > 0) {
            cropFilter.querySelector('.filter-item').classList.add('active');
            currentFilters.crop = crops[0];
        }
    }
}

function attachFilterEvents() {
    // 지역 필터
    document.querySelectorAll('#regionFilter .filter-item').forEach(item => {
        item.addEventListener('click', function() {
            document.querySelectorAll('#regionFilter .filter-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            currentFilters.region = this.dataset.region;
            currentFilters.crop = ''; // 지역 변경 시 작목 선택 초기화
            updateCrops();
            updateDisplay();
        });
    });

    // 작목군 필터
    document.addEventListener('click', function(e) {
        if (e.target.matches('#statusCropGroupFilter .filter-item')) {
            document.querySelectorAll('#statusCropGroupFilter .filter-item').forEach(i => i.classList.remove('active'));
            e.target.classList.add('active');
            currentFilters.cropGroup = e.target.dataset.cropGroup;
            currentFilters.crop = '';
            updateCrops();
            updateDisplay();
        }
    });

    // 작목상세 필터
    document.addEventListener('click', function(e) {
        if (e.target.matches('#cropFilter .filter-item')) {
            document.querySelectorAll('#cropFilter .filter-item').forEach(i => i.classList.remove('active'));
            e.target.classList.add('active');
            currentFilters.crop = e.target.dataset.crop;
            updateDisplay();
        }
    });

    // 연도 필터
    document.addEventListener('click', function(e) {
        if (e.target.matches('#yearFilter .year-btn')) {
            document.querySelectorAll('#yearFilter .year-btn').forEach(i => i.classList.remove('active'));
            e.target.classList.add('active');
            currentFilters.year = e.target.dataset.year;
            currentFilters.crop = ''; // 연도 변경 시 작목 선택 초기화
            updateCrops();
            updateDisplay();
        }
    });
}

// ========== 데이터 업데이트 ==========

function updateDisplay() {
    filterData();
    updateSummary();
    updateSummaryTitle();
    updateTable();
    updateCharts();
}

function filterData() {
    filteredData = csvData.filter(item => {
        return item.region === currentFilters.region &&
               (!currentFilters.cropGroup || item.cropGroup === currentFilters.cropGroup) &&
               (!currentFilters.crop || item.crop === currentFilters.crop) &&
               (!currentFilters.year || item.year === currentFilters.year);
    });
    console.log('필터링된 데이터:', filteredData.length, '개');
}

function updateSummary() {
    const income = filteredData.filter(i => i.category === '소득').reduce((a, b) => a + b.value, 0);
    const rateArr = filteredData.filter(i => i.category === '소득률');
    const avgRate = rateArr.reduce((a, b) => a + b.value, 0) / (rateArr.length || 1);
    
    const totalIncomeEl = document.getElementById('totalIncome');
    const totalRateEl = document.getElementById('totalRate');
    
    if (totalIncomeEl) totalIncomeEl.textContent = `${income.toLocaleString()}원`;
    if (totalRateEl) totalRateEl.textContent = `${avgRate.toFixed(1)}%`;
}

function updateSummaryTitle() {
    const selectedYear = currentFilters.year || '2023';
    const selectedRegion = currentFilters.region || '전국';
    const selectedCrop = currentFilters.crop || '';
    const selectedCropGroup = currentFilters.cropGroup || '';
    
    let titleParts = [selectedYear + '년', selectedRegion];
    
    if (selectedCrop) {
        titleParts.push(selectedCrop);
    } else if (selectedCropGroup) {
        titleParts.push(selectedCropGroup);
    }
    
    titleParts.push('소득분석표');
    
    const summaryTitle = document.getElementById('summaryTitle');
    if (summaryTitle) {
        summaryTitle.innerHTML = titleParts.join(' ') + '<button onclick="exportStatusAnalysisToExcel()" class="excel-download-btn" title="엑셀 다운로드"></button>';
    }

    // 차트 제목 업데이트
    const regionText = selectedRegion;
    const cropDetailText = selectedCrop || selectedCropGroup || '전체작물';
    
    const titles = {
        'totalIncomeTitle': `${regionText} ${cropDetailText} 총수입 추이`,
        'managementCostTitle': `${regionText} ${cropDetailText} 경영비 추이`,
        'incomeRateTitle': `${regionText} ${cropDetailText} 소득 및 소득률`
    };
    
    // 현황 탭용 추가 차트 제목들
    const additionalTitles = {
        'selfLaborTitle': `${selectedYear}년 ${regionText} ${cropDetailText} 자가노동 분포`,
        'hiredLaborTitle': `${selectedYear}년 ${regionText} ${cropDetailText} 고용노동 분포`, 
        'annualLaborTitle': `${regionText} ${cropDetailText} 연간 노동시간`,
        'cropIncomeTitle': `${regionText} ${selectedCropGroup || '전체작물'} 작목별 소득`
    };
    
    Object.entries(titles).forEach(([id, title]) => {
        const element = document.getElementById(id);
        if (element) {
            element.innerHTML = title;
        }
    });
    
    // 추가 차트 제목 업데이트 (현황 탭에서만)
    if (currentTab === 'status') {
        Object.entries(additionalTitles).forEach(([titleId, title]) => {
            const titleElement = document.getElementById(titleId);
            if (titleElement) {
                titleElement.innerHTML = title;
            }
        });
    }
}

// 비교 탭용 제목 업데이트
function updateCompareSummaryTitle() {
    const selectedYear = compareFilters.year || '2023';
    const selectedCrop = compareFilters.crop || '';
    const selectedCropGroup = compareFilters.cropGroup || '';
    
    let titleParts = [selectedYear + '년'];
    
    if (selectedCrop) {
        titleParts.push(selectedCrop);
    } else if (selectedCropGroup) {
        titleParts.push(selectedCropGroup);
    }
    
    titleParts.push('소득비교표');
    
    const compareSummaryTitle = document.getElementById('compareSummaryTitle');
    if (compareSummaryTitle) {
        compareSummaryTitle.innerHTML = titleParts.join(' ') + '<button onclick="exportCompareAnalysisToExcel()" class="excel-download-btn" title="엑셀 다운로드"></button>';
    }

    // 비교 차트 제목 업데이트
    const cropDetailText = selectedCrop || selectedCropGroup || '전체작물';
    
    const compareTitles = {
        'compareTotalIncomeTitle': `${cropDetailText} 총수입 추이`,
        'compareManagementCostTitle': `${cropDetailText} 경영비 추이`,
        'compareIncomeRateTitle': `${cropDetailText} 소득 및 소득률`,
        'compareSelfLaborTitle': `${cropDetailText} 자가노동 분포`,
        'compareHiredLaborTitle': `${cropDetailText} 고용노동 분포`,
        'compareAnnualLaborTitle': `${cropDetailText} 연간 노동시간`,
        'compareCropIncomeTitle': `${selectedYear}년 ${selectedCropGroup || '전체'} 작목별 소득`
    };
    
    Object.entries(compareTitles).forEach(([id, title]) => {
        const element = document.getElementById(id);
        if (element) {
            if (id === 'compareCropIncomeTitle') {
                element.innerHTML = title + '<button onclick="exportCompareIncomeTableToExcel()" class="excel-download-btn" title="엑셀 다운로드"></button>';
            } else {
                element.innerHTML = title;
            }
        }
    });
}

function updateTable() {
    const tableBody = document.getElementById('detailTableBody');
    if (!tableBody) return;
    
    // 현재 필터링된 데이터에서 실제 값을 가진 비목 데이터 매핑
    const itemValueMap = {};
    
    filteredData.forEach(item => {
        itemValueMap[item.category] = item.value;
    });
    
    let html = '';
    
    // 총수입 요약 행
    const totalRevenue = itemValueMap['총수입'] || 0;
    const totalRevenueDisplay = totalRevenue === 0 ? '-' : totalRevenue.toLocaleString();
    html += `
        <tr>
            <td style="background-color: #f8fafc; font-weight: bold;">총수입</td>
            <td style="background-color: #f8fafc; font-weight: bold;">${totalRevenueDisplay}</td>
        </tr>
    `;
    
    // 수입 항목들
    const revenueItems = ['주산물가액', '주산물수량', '부산물가액', '수취가격'];
    revenueItems.forEach(itemName => {
        const value = itemValueMap[itemName];
        const displayValue = (!value && value !== 0) ? '-' : 
                           (value === 0) ? '-' :
                           (typeof value === 'number' ? value.toLocaleString() : value);
        html += `<tr><td>${itemName}</td><td>${displayValue}</td></tr>`;
    });
    
    // 중간재비 요약 행
    let allMaterialCostItems = [];
    
    if (currentFilters.cropGroup === '과수') {
        allMaterialCostItems = [
            '과수원조성비', '보통(무기질)비료비', '부산물(유기질)비료비',
            '농약비', '수도광열비', '기타재료비', '소농구비',
            '대농구상각비', '영농시설상각비', '수리·유지비', '기타비용'
        ];
    } else if (['쌀', '콩', '고추', '양파', '마늘'].includes(currentFilters.crop)) {
        allMaterialCostItems = [
            '종자·종묘비', '보통(무기질)비료비', '부산물(유기질)비료비',
            '농약비', '수도광열비', '기타재료비', '소농구비',
            '대농구상각비', '영농시설상각비', '자동차비', '기타비용'
        ];
    } else {
        allMaterialCostItems = [
            '종자·종묘비', '보통(무기질)비료비', '부산물(유기질)비료비',
            '농약비', '수도광열비', '기타재료비', '소농구비',
            '대농구상각비', '영농시설상각비', '수리·유지비', '기타비용'
        ];
    }
    
    const totalMaterialCost = itemValueMap['중간재비'] || 0;
    const totalMaterialCostDisplay = totalMaterialCost === 0 ? '-' : totalMaterialCost.toLocaleString();
    html += `
        <tr>
            <td style="background-color: #f8fafc; font-weight: bold;">중간재비</td>
            <td style="background-color: #f8fafc; font-weight: bold;">${totalMaterialCostDisplay}</td>
        </tr>
    `;
    
    allMaterialCostItems.forEach(itemName => {
        const value = itemValueMap[itemName];
        const displayValue = (!value && value !== 0) ? '-' : 
                           (value === 0) ? '-' :
                           (typeof value === 'number' ? value.toLocaleString() : value);
        html += `<tr><td>${itemName}</td><td>${displayValue}</td></tr>`;
    });
    
    // 경영비 요약 행
    const totalManagementCost = itemValueMap['경영비'] || 0;
    const totalManagementCostDisplay = totalManagementCost === 0 ? '-' : totalManagementCost.toLocaleString();
    html += `
        <tr>
            <td style="background-color: #f8fafc; font-weight: bold;">경영비</td>
            <td style="background-color: #f8fafc; font-weight: bold;">${totalManagementCostDisplay}</td>
        </tr>
    `;
    
    // 경영비 항목들
    const costItems = ['농기계·시설임차료', '토지임차료', '위탁영농비', '고용노동비'];
    costItems.forEach(itemName => {
        const value = itemValueMap[itemName];
        const displayValue = (!value && value !== 0) ? '-' : 
                           (value === 0) ? '-' :
                           (typeof value === 'number' ? value.toLocaleString() : value);
        html += `<tr><td>${itemName}</td><td>${displayValue}</td></tr>`;
    });
    
    // 생산비 요약 행
    const totalProductionCost = itemValueMap['생산비'] || 0;
    const totalProductionCostDisplay = totalProductionCost === 0 ? '-' : totalProductionCost.toLocaleString();
    html += `
        <tr>
            <td style="background-color: #f8fafc; font-weight: bold;">생산비</td>
            <td style="background-color: #f8fafc; font-weight: bold;">${totalProductionCostDisplay}</td>
        </tr>
    `;
    
    // 생산비 항목들
    const productionItems = ['자가노동비', '유동자본용역비', '고정자본용역비', '토지자본용역비'];
    productionItems.forEach(itemName => {
        const value = itemValueMap[itemName];
        const displayValue = (!value && value !== 0) ? '-' : 
                           (value === 0) ? '-' :
                           (typeof value === 'number' ? value.toLocaleString() : value);
        html += `<tr><td>${itemName}</td><td>${displayValue}</td></tr>`;
    });
    
    // 소득 요약 행
    const totalIncome = itemValueMap['소득'] || 0;
    const totalIncomeDisplay = totalIncome === 0 ? '-' : totalIncome.toLocaleString();
    html += `
        <tr>
            <td style="background-color: #f8fafc; font-weight: bold;">소득</td>
            <td style="background-color: #f8fafc; font-weight: bold;">${totalIncomeDisplay}</td>
        </tr>
    `;
    
    // 소득률 요약 행
    const incomeRate = itemValueMap['소득률'] || 0;
    const incomeRateDisplay = incomeRate === 0 ? '-' : `${incomeRate.toFixed(1)}%`;
    html += `
        <tr>
            <td style="background-color: #f8fafc; font-weight: bold;">소득률</td>
            <td style="background-color: #f8fafc; font-weight: bold;">${incomeRateDisplay}</td>
        </tr>
    `;
    
    // 추가 지표들
    const additionalItems = [
        { key: '부가가치', suffix: '' },
        { key: '부가가치율', suffix: '%' },
        { key: '노동생산성', suffix: '' },
        { key: '자본생산성', suffix: '' },
        { key: '토지생산성', suffix: '' }
    ];
    
    additionalItems.forEach(item => {
        const value = itemValueMap[item.key] || 0;
        let displayValue;
        if (value === 0) {
            displayValue = '-';
        } else if (item.suffix === '%') {
            displayValue = `${value.toFixed(1)}%`;
        } else {
            displayValue = value.toLocaleString();
        }
        
        html += `
            <tr>
                <td style="background-color: #f8fafc; font-weight: bold;">${item.key}</td>
                <td style="background-color: #f8fafc; font-weight: bold;">${displayValue}</td>
            </tr>
        `;
    });
    
    // kg당 생산비와 kg당 경영비를 DB에서 직접 가져오기
    console.log('현재 filteredData에서 kg 관련 카테고리 확인:', 
        filteredData.filter(item => item.category && item.category.includes('kg')).map(item => item.category));
    
    const kgProductionCostItem = filteredData.find(item => item.category === 'kg당 생산비');
    const kgManagementCostItem = filteredData.find(item => item.category === 'kg당 경영비');
    
    console.log('kg당 생산비 데이터:', kgProductionCostItem);
    console.log('kg당 경영비 데이터:', kgManagementCostItem);
    
    const kgProductionCostDisplay = kgProductionCostItem && kgProductionCostItem.value > 0 ? 
        Math.round(kgProductionCostItem.value).toLocaleString() : '-';
    const kgManagementCostDisplay = kgManagementCostItem && kgManagementCostItem.value > 0 ? 
        Math.round(kgManagementCostItem.value).toLocaleString() : '-';
    
    // 노지풋옥수수일 때 개당으로 표시, 아니면 kg당으로 표시
    const unitText = currentFilters.crop === '노지풋옥수수' ? '개당' : 'kg당';
    
    html += `
        <tr>
            <td style="background-color: #f8fafc; font-weight: bold;">${unitText} 생산비</td>
            <td style="background-color: #f8fafc; font-weight: bold;">${kgProductionCostDisplay}</td>
        </tr>
        <tr>
            <td style="background-color: #f8fafc; font-weight: bold;">${unitText} 경영비</td>
            <td style="background-color: #f8fafc; font-weight: bold;">${kgManagementCostDisplay}</td>
        </tr>
    `;
    
    tableBody.innerHTML = html || '<tr><td colspan="2">데이터가 없습니다.</td></tr>';
}

// ========== 차트 제목 업데이트 ==========

function updateChartTitles() {
    const region = currentFilters.region || '';
    const cropGroup = currentFilters.cropGroup || '';
    const crop = currentFilters.crop || '';
    
    // 기본 제목 형식: 지역 + 작물
    let baseTitle = '';
    if (region) baseTitle += region + ' ';
    if (crop) baseTitle += crop + ' ';
    
    // 고정 제목 차트들
    const combinedIncomeTitle = document.getElementById('combinedIncomeTitle');
    if (combinedIncomeTitle) {
        combinedIncomeTitle.textContent = baseTitle + '총수입 및 경영비 추이';
    }
    
    const incomeRateTitle = document.getElementById('incomeRateTitle');
    if (incomeRateTitle) {
        incomeRateTitle.textContent = baseTitle + '소득 및 소득률 추이';
    }
    
    const yieldPriceTitle = document.getElementById('yieldPriceTitle');
    if (yieldPriceTitle) {
        yieldPriceTitle.textContent = baseTitle + '주산물수량 및 수취가격 추이';
    }
    
    const annualLaborTitle = document.getElementById('annualLaborTitle');
    if (annualLaborTitle) {
        annualLaborTitle.textContent = baseTitle + '연간노동시간 추이';
    }
    
    // 드롭다운 차트들 - 현재 선택된 값에 따라
    updateProductivityTitle();
    updateCostEfficiencyTitle();
}

function updateProductivityTitle() {
    const productivitySelector = document.getElementById('productivitySelector');
    const productivityTitle = document.getElementById('productivityTitle');
    
    if (productivitySelector && productivityTitle) {
        const selectedValue = productivitySelector.value;
        const region = currentFilters.region || '';
        const crop = currentFilters.crop || '';
        
        let baseTitle = '';
        if (region) baseTitle += region + ' ';
        if (crop) baseTitle += crop + ' ';
        
        let categoryName = '';
        switch(selectedValue) {
            case 'labor':
                categoryName = '노동생산성';
                break;
            case 'capital':
                categoryName = '자본생산성';
                break;
            case 'land':
                categoryName = '토지생산성';
                break;
        }
        
        productivityTitle.textContent = baseTitle + categoryName + ' 추이';
        
        // 단위 업데이트
        const productivityUnit = document.getElementById('productivityUnit');
        if (productivityUnit) {
            let unit = '';
            switch(selectedValue) {
                case 'labor':
                    unit = '원/시간';
                    break;
                case 'capital':
                    unit = '%';
                    break;
                case 'land':
                    unit = '원/3.3㎡';
                    break;
            }
            productivityUnit.textContent = unit;
        }
    }
}

function updateCostEfficiencyTitle() {
    const costEfficiencySelector = document.getElementById('costEfficiencySelector');
    const costEfficiencyTitle = document.getElementById('costEfficiencyTitle');
    
    if (costEfficiencySelector && costEfficiencyTitle) {
        const selectedValue = costEfficiencySelector.value;
        const region = currentFilters.region || '';
        const crop = currentFilters.crop || '';
        
        let baseTitle = '';
        if (region) baseTitle += region + ' ';
        if (crop) baseTitle += crop + ' ';
        
        let categoryName = '';
        const unit = crop === '노지풋옥수수' ? '개당' : 'kg당';
        switch(selectedValue) {
            case 'production':
                categoryName = `${unit} 생산비`;
                break;
            case 'management':
                categoryName = `${unit} 경영비`;
                break;
        }
        
        costEfficiencyTitle.textContent = baseTitle + categoryName + ' 추이';
    }
}

// ========== 차트 업데이트 ==========

function updateDropdownOptions() {
    const isFootCorn = currentFilters.crop === '노지풋옥수수';
    const isYearlyFootCorn = yearlyFilters.crop === '노지풋옥수수';
    const isCompareFootCorn = compareFilters.crop === '노지풋옥수수';
    
    // costEfficiencySelector 옵션 텍스트 업데이트 (작목별 조회탭)
    const costEfficiencySelector = document.getElementById('costEfficiencySelector');
    if (costEfficiencySelector) {
        const productionOption = costEfficiencySelector.querySelector('option[value="production"]');
        const managementOption = costEfficiencySelector.querySelector('option[value="management"]');
        
        if (productionOption) {
            productionOption.textContent = isFootCorn ? '개당 생산비' : 'kg당 생산비';
        }
        if (managementOption) {
            managementOption.textContent = isFootCorn ? '개당 경영비' : 'kg당 경영비';
        }
    }
    
    // 전국 vs 강원 비교탭 비용 차트 드롭다운 옵션 업데이트
    const compareCostSelect = document.getElementById('compareCostSelect');
    if (compareCostSelect) {
        const managementCostPerKgOption = compareCostSelect.querySelector('option[value="managementCostPerKg"]');
        const costPerKgOption = compareCostSelect.querySelector('option[value="costPerKg"]');
        
        if (managementCostPerKgOption) {
            managementCostPerKgOption.textContent = isCompareFootCorn ? '개당 경영비' : 'kg당 경영비';
        }
        if (costPerKgOption) {
            costPerKgOption.textContent = isCompareFootCorn ? '개당 생산비' : 'kg당 생산비';
        }
    }
    
    // 평년탭 TOP 5 차트 단위 업데이트 (노지풋옥수수와 관계없이 고정)
    updateYearlyTop5Units();
}

function updateYearlyTop5Units() {
    // 강원 평년 TOP 5 단위 업데이트
    const yearlyTop5Filter = document.getElementById('yearlyTop5CategoryFilter');
    const yearlyTop5Unit = document.getElementById('yearlyTop5Unit');
    if (yearlyTop5Filter && yearlyTop5Unit) {
        const selectedCategory = yearlyTop5Filter.value;
        let unit = getYearlyTop5Unit(selectedCategory);
        yearlyTop5Unit.textContent = unit;
    }
    
    // 전국 평년 TOP 5 단위 업데이트
    const yearlyNationalTop5Filter = document.getElementById('yearlyNationalTop5CategoryFilter');
    const yearlyNationalTop5Unit = document.getElementById('yearlyNationalTop5Unit');
    if (yearlyNationalTop5Filter && yearlyNationalTop5Unit) {
        const selectedCategory = yearlyNationalTop5Filter.value;
        let unit = getYearlyTop5Unit(selectedCategory);
        yearlyNationalTop5Unit.textContent = unit;
    }
}

function getYearlyTop5Unit(category) {
    switch(category) {
        case '총수입':
        case '경영비':
        case '소득':
            return '원/10a';
        case '소득률':
            return '%';
        case '노동생산성':
            return '원/시간';
        case '자본생산성':
            return '%';
        case '토지생산성':
            return '원/3.3㎡';
        case 'kg당 생산비':
            return '원/kg';
        default:
            return '원/10a';
    }
}

function updateChartUnits() {
    const isFootCorn = currentFilters.crop === '노지풋옥수수';
    
    // costEfficiencyChart 단위 업데이트
    const costEfficiencyUnit = document.getElementById('costEfficiencyUnit');
    if (costEfficiencyUnit) {
        costEfficiencyUnit.textContent = isFootCorn ? '원/개' : '원/kg';
    }
    
    // yieldPriceChart 단위 업데이트
    const yieldPriceUnit = document.getElementById('yieldPriceUnit');
    if (yieldPriceUnit) {
        yieldPriceUnit.textContent = isFootCorn ? '개/10a, 원/개' : 'kg/10a, 원/kg';
    }
    
    // 모든 table 단위 업데이트
    const generalUnits = '원/10a, kg/10a, 원/kg, %, 원/시간, 원/3.3㎡';
    const footCornUnits = '원/10a, 개/10a, 원/개, %, 원/시간, 원/3.3㎡';
    const tableUnits = isFootCorn ? footCornUnits : generalUnits;
    
    // detailTable 단위 업데이트
    const detailTableUnit = document.getElementById('detailTableUnit');
    if (detailTableUnit) {
        detailTableUnit.textContent = tableUnits;
    }
    
    // compareTableUnit 단위 업데이트 (전국 vs 강원 비교표)
    const compareTableUnit = document.getElementById('compareTableUnit');
    if (compareTableUnit) {
        compareTableUnit.textContent = tableUnits;
    }
    
    // yearlyAnalysisTableUnit 단위 업데이트 (평년 분석표)
    const yearlyAnalysisTableUnit = document.getElementById('yearlyAnalysisTableUnit');
    if (yearlyAnalysisTableUnit) {
        yearlyAnalysisTableUnit.textContent = tableUnits;
    }
    
    // yearlyCropIncomeTableUnit 단위 업데이트 (평년 작목별 소득표 - 고정값)
    const yearlyCropIncomeTableUnit = document.getElementById('yearlyCropIncomeTableUnit');
    if (yearlyCropIncomeTableUnit) {
        yearlyCropIncomeTableUnit.textContent = '원/10a, %';
    }
}

function updateCharts() {
    // 차트 제목 업데이트
    updateChartTitles();
    
    // 드롭다운 옵션 텍스트 업데이트
    updateDropdownOptions();
    
    // 차트 단위 업데이트
    updateChartUnits();
    
    // 각 차트 업데이트 (동적 년도 사용)
    updateCombinedIncomeChart();
    updateIncomeRateChart();
    updateProductivityChart();
    updateCostEfficiencyChart();
    updateYieldPriceChart();
    updateAnnualLaborChart();
}

function updateCombinedIncomeChart() {
    // 현재 필터 조건에 맞는 데이터가 있는 년도들을 동적으로 추출
    const availableYears = new Set();
    
    csvData.forEach(row => {
        if ((row.category === '총수입' || row.category === '경영비') &&
            row.region === currentFilters.region &&
            (!currentFilters.cropGroup || row.cropGroup === currentFilters.cropGroup) &&
            (!currentFilters.crop || row.crop === currentFilters.crop) &&
            row.value > 0) {
            availableYears.add(row.year);
        }
    });
    
    // 년도를 정렬
    const years = Array.from(availableYears).sort();
    
    if (years.length === 0) {
        // 데이터가 없으면 차트를 비움
        const ctx = document.getElementById('combinedIncomeChart')?.getContext('2d');
        if (ctx && charts['combinedIncomeChart']) {
            charts['combinedIncomeChart'].destroy();
        }
        return;
    }
    
    const incomeValues = years.map(y => {
        const match = csvData.find(row =>
            row.category === '총수입' &&
            row.year === y &&
            row.region === currentFilters.region &&
            (!currentFilters.cropGroup || row.cropGroup === currentFilters.cropGroup) &&
            (!currentFilters.crop || row.crop === currentFilters.crop)
        );
        return match ? match.value : 0;
    });
    
    const costValues = years.map(y => {
        const match = csvData.find(row =>
            row.category === '경영비' &&
            row.year === y &&
            row.region === currentFilters.region &&
            (!currentFilters.cropGroup || row.cropGroup === currentFilters.cropGroup) &&
            (!currentFilters.crop || row.crop === currentFilters.crop)
        );
        return match ? match.value : 0;
    });

    const maxValue = Math.max(...incomeValues, ...costValues);
    const yAxisMax = maxValue * 1.4;

    const ctx = document.getElementById('combinedIncomeChart')?.getContext('2d');
    if (!ctx) return;
    
    if (charts['combinedIncomeChart']) charts['combinedIncomeChart'].destroy();

    const incomeGradient = ctx.createLinearGradient(0, 0, 0, 400);
    incomeGradient.addColorStop(0, 'rgba(29, 78, 216, 0.8)');
    incomeGradient.addColorStop(1, 'rgba(59, 130, 246, 0.3)');
    
    const costGradient = ctx.createLinearGradient(0, 0, 0, 400);
    costGradient.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
    costGradient.addColorStop(1, 'rgba(147, 197, 253, 0.3)');

    charts['combinedIncomeChart'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years.map(y => y + '년'),
            datasets: [{
                label: '총수입',
                data: incomeValues,
                borderColor: '#1d4ed8',
                backgroundColor: 'transparent',
                borderWidth: 4,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: '#1d4ed8',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 3,
                tension: 0.4,
                fill: false,
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    formatter: value => value.toLocaleString(),
                    font: { size: 12, weight: 'bold' },
                    color: '#1d4ed8'
                }
            }, {
                label: '경영비',
                data: costValues,
                borderColor: '#3b82f6',
                backgroundColor: 'transparent',
                borderWidth: 4,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: '#3b82f6',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 3,
                tension: 0.4,
                fill: false,
                datalabels: {
                    anchor: 'end',
                    align: 'bottom',
                    offset: 15,
                    formatter: value => value.toLocaleString(),
                    font: { size: 12, weight: 'bold' },
                    color: '#3b82f6'
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    left: 30,
                    right: 30,
                    top: 5,
                    bottom: 5
                }
            },
            plugins: { 
                legend: { 
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 8
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(30, 64, 175, 0.95)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#1e40af',
                    borderWidth: 2,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + context.parsed.y.toLocaleString() + '원/10a';
                        }
                    }
                },
                datalabels: { display: true }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 12, weight: 'bold' },
                        color: '#000000'
                    }
                },
                y: {
                    display: false,
                    beginAtZero: true,
                    max: yAxisMax
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

function updateProductivityChart() {
    // 현재 필터 조건에 맞는 데이터가 있는 년도들을 동적으로 추출
    const availableYears = new Set();
    
    csvData.forEach(row => {
        if ((row.category === '노동생산성' || row.category === '자본생산성' || row.category === '토지생산성') &&
            row.region === currentFilters.region &&
            (!currentFilters.cropGroup || row.cropGroup === currentFilters.cropGroup) &&
            (!currentFilters.crop || row.crop === currentFilters.crop) &&
            row.value > 0) {
            availableYears.add(row.year);
        }
    });
    
    // 년도를 정렬
    const years = Array.from(availableYears).sort();
    
    if (years.length === 0) {
        const ctx = document.getElementById('productivityChart')?.getContext('2d');
        if (ctx && charts['productivityChart']) {
            charts['productivityChart'].destroy();
        }
        return;
    }
    const productivityType = document.getElementById('productivitySelector')?.value || 'labor';
    let categoryName = '';
    let chartColor = '#3b82f6';
    
    switch(productivityType) {
        case 'labor':
            categoryName = '노동생산성';
            chartColor = '#1e40af';
            break;
        case 'capital':
            categoryName = '자본생산성';
            chartColor = '#1e40af';
            break;
        case 'land':
            categoryName = '토지생산성';
            chartColor = '#1e40af';
            break;
    }
    
    const values = years.map(y => {
        const match = csvData.find(row =>
            row.category === categoryName &&
            row.year === y &&
            row.region === currentFilters.region &&
            (!currentFilters.cropGroup || row.cropGroup === currentFilters.cropGroup) &&
            (!currentFilters.crop || row.crop === currentFilters.crop)
        );
        return match ? match.value : 0;
    });

    const maxValue = Math.max(...values);
    const yAxisMax = maxValue * 1.5;

    const ctx = document.getElementById('productivityChart')?.getContext('2d');
    if (!ctx) return;
    
    if (charts['productivityChart']) charts['productivityChart'].destroy();

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, chartColor + 'CC');
    gradient.addColorStop(1, chartColor + '33');

    charts['productivityChart'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years.map(y => y + '년'),
            datasets: [{
                data: values,
                borderColor: chartColor,
                backgroundColor: gradient,
                borderWidth: 4,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: chartColor,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 3,
                tension: 0.4,
                fill: true,
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    formatter: value => value.toLocaleString(),
                    font: { size: 12, weight: 'bold' },
                    color: chartColor
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    left: 30,
                    right: 30,
                    top: 5,
                    bottom: 5
                }
            },
            plugins: { 
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(30, 64, 175, 0.95)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#1e40af',
                    borderWidth: 2,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            const selector = document.getElementById('productivitySelector');
                            const selectedValue = selector ? selector.value : 'labor';
                            let unit = '';
                            let categoryName = '';
                            
                            switch(selectedValue) {
                                case 'labor':
                                    unit = '원/시간';
                                    categoryName = '노동생산성';
                                    break;
                                case 'capital':
                                    unit = '%';
                                    categoryName = '자본생산성';
                                    break;
                                case 'land':
                                    unit = '원/3.3㎡';
                                    categoryName = '토지생산성';
                                    break;
                            }
                            
                            return categoryName + ': ' + context.parsed.y.toLocaleString() + unit;
                        }
                    }
                },
                datalabels: { display: true }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 12, weight: 'bold' },
                        color: '#000000'
                    }
                },
                y: {
                    display: false,
                    beginAtZero: true,
                    max: yAxisMax
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

function updateIncomeRateChart() {
    // 현재 필터에 따라 사용 가능한 년도 계산
    const availableYears = new Set();
    csvData.forEach(row => {
        if ((row.category === '소득' || row.category === '소득률') &&
            row.region === currentFilters.region &&
            (!currentFilters.cropGroup || row.cropGroup === currentFilters.cropGroup) &&
            (!currentFilters.crop || row.crop === currentFilters.crop) &&
            row.value > 0) {
            availableYears.add(row.year);
        }
    });
    
    // 년도를 정렬
    const years = Array.from(availableYears).sort();
    const incomeValues = years.map(y => {
        const match = csvData.find(row =>
            row.category === '소득' &&
            row.year === y &&
            row.region === currentFilters.region &&
            (!currentFilters.cropGroup || row.cropGroup === currentFilters.cropGroup) &&
            (!currentFilters.crop || row.crop === currentFilters.crop)
        );
        return match ? match.value : 0;
    });

    const rateValues = years.map(y => {
        const match = csvData.find(row =>
            row.category === '소득률' &&
            row.year === y &&
            row.region === currentFilters.region &&
            (!currentFilters.cropGroup || row.cropGroup === currentFilters.cropGroup) &&
            (!currentFilters.crop || row.crop === currentFilters.crop)
        );
        return match ? match.value : 0;
    });

    const maxIncomeValue = Math.max(...incomeValues);
    const maxRateValue = Math.max(...rateValues);
    const incomeAxisMax = maxIncomeValue * 1.4;
    const rateAxisMax = maxRateValue * 1.4;

    const ctx = document.getElementById('incomeRateChart')?.getContext('2d');
    if (!ctx) return;
    
    if (charts['incomeRateChart']) charts['incomeRateChart'].destroy();

    charts['incomeRateChart'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: years.map(y => y + '년'),
            datasets: [
                {
                    label: '소득',
                    data: incomeValues,
                    type: 'bar',
                    backgroundColor: 'rgba(59, 130, 246, 0.5)',
                    borderColor: 'transparent',
                    borderWidth: 0,
                    yAxisID: 'y',
                    datalabels: {
                        anchor: 'center',
                        align: 'center',
                        formatter: value => value.toLocaleString(),
                        font: { size: 12, weight: 'bold' },
                        color: '#000000'
                    }
                },
                {
                    label: '소득률',
                    data: rateValues,
                    type: 'line',
                    borderColor: '#1d4ed8',
                    backgroundColor: '#1d4ed8',
                    borderWidth: 4,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#1d4ed8',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 3,
                    tension: 0.4,
                    yAxisID: 'y1',
                    fill: false,
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        formatter: value => value.toFixed(1) + '%',
                        font: { size: 12, weight: 'bold' },
                        color: '#1d4ed8'
                    }
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    left: 30,
                    right: 30,
                    top: 5,
                    bottom: 5
                }
            },
            plugins: { 
                datalabels: { display: true },
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(30, 64, 175, 0.95)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#1e40af',
                    borderWidth: 2,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            if (context.datasetIndex === 0) {
                                return '소득: ' + context.parsed.y.toLocaleString() + '원';
                            } else {
                                return '소득률: ' + context.parsed.y + '%';
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 12, weight: 'bold' },
                        color: '#000000'
                    }
                },
                y: {
                    display: false,
                    beginAtZero: true,
                    position: 'left',
                    max: incomeAxisMax
                },
                y1: {
                    display: false,
                    beginAtZero: true,
                    position: 'right',
                    max: rateAxisMax
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

function updateYieldPriceChart() {
    // 현재 필터에 따라 사용 가능한 년도 계산
    const availableYears = new Set();
    csvData.forEach(row => {
        if ((row.category === '주산물수량' || row.category === '주산물단가') &&
            row.region === currentFilters.region &&
            (!currentFilters.cropGroup || row.cropGroup === currentFilters.cropGroup) &&
            (!currentFilters.crop || row.crop === currentFilters.crop) &&
            row.value > 0) {
            availableYears.add(row.year);
        }
    });
    
    // 년도를 정렬
    const years = Array.from(availableYears).sort();
    const yieldValues = years.map(y => {
        const match = csvData.find(row =>
            row.category === '주산물수량' &&
            row.year === y &&
            row.region === currentFilters.region &&
            (!currentFilters.cropGroup || row.cropGroup === currentFilters.cropGroup) &&
            (!currentFilters.crop || row.crop === currentFilters.crop)
        );
        return match ? match.value : 0;
    });

    const priceValues = years.map(y => {
        const match = csvData.find(row =>
            row.category === '수취가격' &&
            row.year === y &&
            row.region === currentFilters.region &&
            (!currentFilters.cropGroup || row.cropGroup === currentFilters.cropGroup) &&
            (!currentFilters.crop || row.crop === currentFilters.crop)
        );
        return match ? match.value : 0;
    });

    const maxYieldValue = Math.max(...yieldValues);
    const maxPriceValue = Math.max(...priceValues);
    const yieldAxisMax = maxYieldValue * 1.4;
    const priceAxisMax = maxPriceValue * 1.4;

    const ctx = document.getElementById('yieldPriceChart')?.getContext('2d');
    if (!ctx) return;
    
    if (charts['yieldPriceChart']) charts['yieldPriceChart'].destroy();

    charts['yieldPriceChart'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: years.map(y => y + '년'),
            datasets: [
                {
                    label: '주산물수량',
                    data: yieldValues,
                    type: 'bar',
                    backgroundColor: 'rgba(59, 130, 246, 0.5)',
                    borderColor: 'transparent',
                    borderWidth: 0,
                    yAxisID: 'y',
                    datalabels: {
                        anchor: 'center',
                        align: 'center',
                        formatter: value => {
                            const unit = currentFilters.crop === '노지풋옥수수' ? '개' : 'kg';
                            return value.toLocaleString() + unit;
                        },
                        font: { size: 12, weight: 'bold' },
                        color: '#000000'
                    }
                },
                {
                    label: '수취가격',
                    data: priceValues,
                    type: 'line',
                    borderColor: '#1d4ed8',
                    backgroundColor: '#1d4ed8',
                    borderWidth: 4,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#1d4ed8',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 3,
                    tension: 0.4,
                    yAxisID: 'y1',
                    fill: false,
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        formatter: value => value.toLocaleString() + '원',
                        font: { size: 12, weight: 'bold' },
                        color: '#1d4ed8'
                    }
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    left: 30,
                    right: 30,
                    top: 5,
                    bottom: 5
                }
            },
            plugins: { 
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(30, 64, 175, 0.95)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#1e40af',
                    borderWidth: 2,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            if (context.datasetIndex === 0) {
                                // 주산물수량
                                const unit = currentFilters.crop === '노지풋옥수수' ? '개/10a' : 'kg/10a';
                                return '주산물수량: ' + context.parsed.y.toLocaleString() + unit;
                            } else {
                                // 수취가격
                                const unit = currentFilters.crop === '노지풋옥수수' ? '원/개' : '원/kg';
                                return '수취가격: ' + context.parsed.y.toLocaleString() + unit;
                            }
                        }
                    }
                },
                datalabels: { display: true }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 12, weight: 'bold' },
                        color: '#000000'
                    }
                },
                y: {
                    type: 'linear',
                    display: false,
                    position: 'left',
                    beginAtZero: true,
                    max: yieldAxisMax
                },
                y1: {
                    type: 'linear',
                    display: false,
                    position: 'right',
                    beginAtZero: true,
                    max: priceAxisMax,
                    grid: {
                        drawOnChartArea: false,
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

function updateCostEfficiencyChart() {
    const costType = document.getElementById('costEfficiencySelector')?.value || 'production';
    let categoryName = '';
    let costCategoryName = '';
    let chartColor = '#3b82f6';
    
    switch(costType) {
        case 'production':
            categoryName = 'kg당 생산비';
            costCategoryName = '생산비';
            chartColor = '#1e40af';
            break;
        case 'management':
            categoryName = 'kg당 경영비';
            costCategoryName = '경영비';
            chartColor = '#1e40af';
            break;
    }
    
    // 현재 필터에 따라 사용 가능한 년도 계산
    const availableYears = new Set();
    csvData.forEach(row => {
        if ((row.category === '주산물수량' || row.category === costCategoryName) &&
            row.region === currentFilters.region &&
            (!currentFilters.cropGroup || row.cropGroup === currentFilters.cropGroup) &&
            (!currentFilters.crop || row.crop === currentFilters.crop) &&
            row.value > 0) {
            availableYears.add(row.year);
        }
    });
    
    // 년도를 정렬
    const years = Array.from(availableYears).sort();
    
    const values = years.map(y => {
        const yieldMatch = csvData.find(row =>
            row.category === '주산물수량' &&
            row.year === y &&
            row.region === currentFilters.region &&
            (!currentFilters.cropGroup || row.cropGroup === currentFilters.cropGroup) &&
            (!currentFilters.crop || row.crop === currentFilters.crop)
        );
        const costMatch = csvData.find(row =>
            row.category === costCategoryName &&
            row.year === y &&
            row.region === currentFilters.region &&
            (!currentFilters.cropGroup || row.cropGroup === currentFilters.cropGroup) &&
            (!currentFilters.crop || row.crop === currentFilters.crop)
        );
        
        const yieldValue = yieldMatch ? yieldMatch.value : 0;
        const costValue = costMatch ? costMatch.value : 0;
        
        return yieldValue > 0 ? (costValue / yieldValue) : 0;
    });

    const maxValue = Math.max(...values);
    const yAxisMax = maxValue * 1.5;

    const ctx = document.getElementById('costEfficiencyChart')?.getContext('2d');
    if (!ctx) return;
    
    if (charts['costEfficiencyChart']) charts['costEfficiencyChart'].destroy();

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, chartColor + 'CC');
    gradient.addColorStop(1, chartColor + '33');

    charts['costEfficiencyChart'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years.map(y => y + '년'),
            datasets: [{
                data: values,
                borderColor: chartColor,
                backgroundColor: gradient,
                borderWidth: 4,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: chartColor,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 3,
                tension: 0.4,
                fill: true,
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    formatter: value => Math.round(value).toLocaleString(),
                    font: { size: 12, weight: 'bold' },
                    color: chartColor
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    left: 30,
                    right: 30,
                    top: 5,
                    bottom: 5
                }
            },
            plugins: { 
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(30, 64, 175, 0.95)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#1e40af',
                    borderWidth: 2,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            const unit = currentFilters.crop === '노지풋옥수수' ? '원/개' : '원/kg';
                            return categoryName + ': ' + context.parsed.y.toLocaleString() + unit;
                        }
                    }
                },
                datalabels: { display: true }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 12, weight: 'bold' },
                        color: '#000000'
                    }
                },
                y: {
                    display: false,
                    beginAtZero: true,
                    max: yAxisMax
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

function updateAnnualLaborChart() {
    // 현재 필터에 따라 사용 가능한 년도 계산
    const availableYears = new Set();
    csvData.forEach(row => {
        if ((row.category === '자가노동시간' || row.category === '고용노동시간') &&
            row.region === currentFilters.region &&
            (!currentFilters.cropGroup || row.cropGroup === currentFilters.cropGroup) &&
            (!currentFilters.crop || row.crop === currentFilters.crop) &&
            row.value > 0) {
            availableYears.add(row.year);
        }
    });
    
    // 년도를 정렬
    const years = Array.from(availableYears).sort();

    const selfLaborData = years.map(y => {
        const match = csvData.find(row =>
            row.category === '자가노동시간' &&
            row.year === y &&
            row.region === currentFilters.region &&
            (!currentFilters.cropGroup || row.cropGroup === currentFilters.cropGroup) &&
            (!currentFilters.crop || row.crop === currentFilters.crop)
        );
        return match ? match.value : 0;
    });

    const hiredLaborData = years.map(y => {
        const match = csvData.find(row =>
            row.category === '고용노동시간' &&
            row.year === y &&
            row.region === currentFilters.region &&
            (!currentFilters.cropGroup || row.cropGroup === currentFilters.cropGroup) &&
            (!currentFilters.crop || row.crop === currentFilters.crop)
        );
        return match ? match.value : 0;
    });

    const stackedTotals = years.map((_, index) => 
        selfLaborData[index] + hiredLaborData[index]
    );
    const maxStackedValue = Math.max(...stackedTotals);
    const yAxisMax = maxStackedValue * 1.3;

    const ctx = document.getElementById('annualLaborChart')?.getContext('2d');
    if (!ctx) return;
    
    if (charts['annualLaborChart']) charts['annualLaborChart'].destroy();

    charts['annualLaborChart'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: years.map(y => y + '년'),
            datasets: [
                {
                    label: '자가노동시간',
                    data: selfLaborData,
                    backgroundColor: 'rgba(147, 197, 253, 0.9)',
                    borderColor: 'transparent',
                    borderWidth: 0
                },
                {
                    label: '고용노동시간',
                    data: hiredLaborData,
                    backgroundColor: 'rgba(191, 219, 254, 0.9)',
                    borderColor: 'transparent',
                    borderWidth: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    left: 30,
                    right: 30,
                    top: 5,
                    bottom: 5
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(30, 64, 175, 0.95)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#1e40af',
                    borderWidth: 2,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + context.parsed.y + '시간';
                        }
                    }
                },
                datalabels: {
                    anchor: 'center',
                    align: 'center',
                    font: { weight: 'bold', size: 12 },
                    formatter: function(value, context) {
                        const label = context.dataset.label;
                        if(label === '자가노동시간') {
                            return '자가\n' + value.toFixed(1);
                        } else if(label === '고용노동시간') {
                            return '고용\n' + value.toFixed(1);
                        }
                        return value.toFixed(1);
                    },
                    color: '#000000'
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: {
                        font: { size: 12, weight: 'bold' },
                        color: '#000000'
                    }
                },
                y: {
                    stacked: true,
                    display: false,
                    beginAtZero: true,
                    max: yAxisMax
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

function updateCropIncomeChart() {
    let cropIncomeData = csvData.filter(item => {
        return item.category === '소득' &&
               item.region === currentFilters.region &&
               item.year === currentFilters.year &&
               (!currentFilters.cropGroup || item.cropGroup === currentFilters.cropGroup);
    });

    const cropIncomes = cropIncomeData
        .map(item => ({
            crop: item.crop,
            income: item.value
        }))
        .sort((a, b) => b.income - a.income)
        .slice(0, 8); // 상위 8개만 표시

    const ctx = document.getElementById('cropIncomeChart')?.getContext('2d');
    if (!ctx) return;
    
    if (charts['cropIncomeChart']) charts['cropIncomeChart'].destroy();

    const maxValue = Math.max(...cropIncomes.map(item => item.income));

    charts['cropIncomeChart'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: cropIncomes.map(item => item.crop),
            datasets: [{
                label: '소득',
                data: cropIncomes.map(item => item.income),
                backgroundColor: cropIncomes.map((_, index) => 
                    `rgba(${30 + index * 10}, ${64 + index * 20}, ${175 - index * 15}, 0.8)`
                ),
                borderColor: 'transparent',
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            indexAxis: 'y',
            maintainAspectRatio: false,
            layout: {
                padding: {
                    left: 30,
                    right: 30,
                    top: 5,
                    bottom: 5
                }
            },
            scales: {
                x: {
                    display: false,
                    grid: { display: false },
                    max: maxValue * 1.3
                },
                y: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 12, weight: 'bold' },
                        color: '#1e40af'
                    }
                }
            },
            plugins: {
                datalabels: {
                    anchor: 'end',
                    align: 'right',
                    formatter: value => value.toLocaleString() + '원/10a',
                    font: { size: 11, weight: 'bold'},
                    color: '#1e40af'
                },
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(30, 64, 175, 0.95)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#1e40af',
                    borderWidth: 2,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            return '소득: ' + context.parsed.x.toLocaleString() + '원/10a';
                        }
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

// ========== 반응형 사이드바 관리 ==========

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.querySelector('.mobile-toggle-btn');
    
    if (!sidebar) {
        console.error('사이드바를 찾을 수 없습니다.');
        return;
    }
    
    if (sidebar.classList.contains('expanded')) {
        // 축소
        sidebar.classList.remove('expanded');
        sidebar.classList.add('collapsed');
        // 배경 스크롤 활성화
        document.body.style.overflow = '';
        if (toggleBtn) {
            toggleBtn.textContent = '필터 ▼';
            toggleBtn.setAttribute('aria-expanded', 'false');
        }
    } else {
        // 확장
        sidebar.classList.remove('collapsed');
        sidebar.classList.add('expanded');
        // 배경 스크롤 차단
        document.body.style.overflow = 'hidden';
        if (toggleBtn) {
            toggleBtn.textContent = '필터 ▲';
            toggleBtn.setAttribute('aria-expanded', 'true');
        }
    }
}

function ensureToggleExists() {
    let btn = document.querySelector('.mobile-toggle-btn');
    if (btn) return btn;

    btn = document.createElement('button');
    btn.className = 'mobile-toggle-btn';
    btn.type = 'button';
    btn.innerText = '필터 ▼';
    btn.setAttribute('aria-expanded', 'false');
    
    btn.addEventListener('click', function(e) {
        e.preventDefault();
        toggleSidebar();
    });
    
    btn.addEventListener('touchstart', function(e) {
        e.preventDefault();
        toggleSidebar();
    });
    
    const container = document.querySelector('.container');
    if (container) {
        container.appendChild(btn);
    } else {
        document.body.appendChild(btn);
    }
    
    return btn;
}

function handleResize() {
    const width = window.innerWidth;
    const sidebar = document.getElementById('sidebar');
    const container = document.querySelector('.container');
    const toggleBtn = ensureToggleExists();

    if (!container) return;

    if (width >= 1401) {
        // 데스크탑 모드
        if (toggleBtn) {
            toggleBtn.style.display = 'none';
            toggleBtn.setAttribute('aria-hidden', 'true');
        }

        if (sidebar) {
            sidebar.classList.remove('expanded', 'collapsed');
            sidebar.style.maxHeight = '';
            sidebar.style.overflow = '';
        }
    } else {
        // 모바일 모드
        if (toggleBtn) {
            toggleBtn.style.display = 'block';
            toggleBtn.setAttribute('aria-hidden', 'false');
        }

        if (sidebar && !sidebar.classList.contains('expanded')) {
            sidebar.classList.add('collapsed');
        }
    }
}

function initResponsiveSidebar() {
    const toggleBtn = ensureToggleExists();
    const sidebar = document.getElementById('sidebar');

    // 초기 상태 설정
    if (sidebar && window.innerWidth <= 1400) {
        sidebar.classList.remove('expanded');
        sidebar.classList.add('collapsed');
    }

    // Resize 이벤트 (디바운스)
    let resizeTimer = null;
    window.addEventListener('resize', () => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(handleResize, 150);
    });

    // 초기 상태 적용
    handleResize();
}

// ========== 비교 탭 데이터 업데이트 ==========

function updateCompareDisplay() {
    updateCompareSummary();
    updateCompareSummaryTitle();
    updateCompareTable();
    updateCompareCharts();
}

function updateCompareSummary() {
    // 전국 데이터
    const nationalData = csvData.filter(item => {
        return item.region === '전국' &&
               (!compareFilters.cropGroup || item.cropGroup === compareFilters.cropGroup) &&
               (!compareFilters.crop || item.crop === compareFilters.crop) &&
               (!compareFilters.year || item.year === compareFilters.year);
    });
    
    // 강원 데이터
    const gangwonData = csvData.filter(item => {
        return item.region === '강원' &&
               (!compareFilters.cropGroup || item.cropGroup === compareFilters.cropGroup) &&
               (!compareFilters.crop || item.crop === compareFilters.crop) &&
               (!compareFilters.year || item.year === compareFilters.year);
    });
    
    const nationalIncome = nationalData.filter(i => i.category === '소득').reduce((a, b) => a + b.value, 0);
    const gangwonIncome = gangwonData.filter(i => i.category === '소득').reduce((a, b) => a + b.value, 0);
    const difference = Math.abs(nationalIncome - gangwonIncome);
    const ratio = nationalIncome > 0 ? ((gangwonIncome / nationalIncome) * 100) : 0;
    const changeRate = ratio === 0 ? 0 : ratio - 100;
    
    const compareNationalIncomeEl = document.getElementById('compareNationalIncome');
    const compareGangwonIncomeEl = document.getElementById('compareGangwonIncome');
    const compareDifferenceEl = document.getElementById('compareDifference');
    const compareRatioEl = document.getElementById('compareRatio');
    
    const changeRateDisplay = changeRate === 0 ? '0.0%' : 
        changeRate > 0 ? `▲ +${changeRate.toFixed(1)}%` : 
        `▼ ${changeRate.toFixed(1)}%`;
    
    // 색상 설정: 강원이 전국보다 낮으면 파란색, 높으면 빨간색
    const diffColor = gangwonIncome < nationalIncome ? '#1e40af' : '#dc2626';
    const ratioColor = gangwonIncome < nationalIncome ? '#1e40af' : '#dc2626';
    
    if (compareNationalIncomeEl) {
        compareNationalIncomeEl.textContent = `${nationalIncome.toLocaleString()}원`;
        compareNationalIncomeEl.style.color = 'black';
    }
    if (compareGangwonIncomeEl) {
        compareGangwonIncomeEl.textContent = `${gangwonIncome.toLocaleString()}원`;
        compareGangwonIncomeEl.style.color = 'black';
    }
    if (compareDifferenceEl) {
        compareDifferenceEl.textContent = `${difference.toLocaleString()}원`;
        compareDifferenceEl.style.color = diffColor;
    }
    if (compareRatioEl) {
        compareRatioEl.textContent = changeRateDisplay;
        compareRatioEl.style.color = ratioColor;
    }
}

function updateCompareTable() {
    const tableBody = document.getElementById('compareDetailTableBody');
    if (!tableBody) return;
    
    // 현재 필터링된 데이터에서 전국과 강원의 실제 값을 가진 항목들 찾기
    const nationalData = csvData.filter(item => {
        return item.region === '전국' &&
               item.year === compareFilters.year &&
               (!compareFilters.cropGroup || item.cropGroup === compareFilters.cropGroup) &&
               (!compareFilters.crop || item.crop === compareFilters.crop);
    });
    
    const gangwonData = csvData.filter(item => {
        return item.region === '강원' &&
               item.year === compareFilters.year &&
               (!compareFilters.cropGroup || item.cropGroup === compareFilters.cropGroup) &&
               (!compareFilters.crop || item.crop === compareFilters.crop);
    });
    
    // 전국과 강원에서 모두 존재하는 항목들을 찾기
    const nationalItemMap = {};
    const gangwonItemMap = {};
    
    nationalData.forEach(item => {
        nationalItemMap[item.category] = item.value;
    });
    
    gangwonData.forEach(item => {
        gangwonItemMap[item.category] = item.value;
    });
    
    // 모든 비목에 대해 표시
    const allItems = [...new Set([...Object.keys(nationalItemMap), ...Object.keys(gangwonItemMap)])];
    
    let html = '';
    
    // 총수입 박스
    const nationalTotalRevenue = nationalItemMap['총수입'] || 0;
    const gangwonTotalRevenue = gangwonItemMap['총수입'] || 0;
    const revenueDiff = nationalTotalRevenue - gangwonTotalRevenue;
    const revenueRatio = nationalTotalRevenue > 0 ? ((gangwonTotalRevenue / nationalTotalRevenue) * 100) : 0;
    const revenueChangeRate = revenueRatio === 0 ? 0 : revenueRatio - 100;
    
    const revenueDiffColor = gangwonTotalRevenue > nationalTotalRevenue ? 'color: #dc2626;' : 'color: #1e40af;';
    const revenueRatioColor = revenueChangeRate > 0 ? 'color: #dc2626;' : revenueChangeRate < 0 ? 'color: #1e40af;' : 'color: #64748b;';
    
    const nationalTotalRevenueDisplay = nationalTotalRevenue === 0 ? '-' : nationalTotalRevenue.toLocaleString();
    const gangwonTotalRevenueDisplay = gangwonTotalRevenue === 0 ? '-' : gangwonTotalRevenue.toLocaleString();
    const revenueDiffDisplay = Math.abs(revenueDiff) === 0 ? '-' : Math.abs(revenueDiff).toLocaleString();
    const revenueRatioDisplay = revenueRatio === 0 ? '-' : 
        revenueChangeRate > 0 ? `▲ +${revenueChangeRate.toFixed(1)}%` : 
        revenueChangeRate < 0 ? `▼ ${revenueChangeRate.toFixed(1)}%` : `0.0%`;
    
    html += `
        <tr>
            <td style="background-color: #f8fafc; font-weight: bold;">총수입</td>
            <td style="background-color: #f8fafc; font-weight: bold;">${nationalTotalRevenueDisplay}</td>
            <td style="background-color: #f8fafc; font-weight: bold;">${gangwonTotalRevenueDisplay}</td>
            <td style="background-color: #f8fafc; font-weight: bold; ${revenueDiffColor}">${revenueDiffDisplay}</td>
            <td style="background-color: #f8fafc; font-weight: bold; ${revenueRatioColor}">${revenueRatioDisplay}</td>
        </tr>
    `;
    
    const revenueItems = ['주산물가액', '주산물수량', '부산물가액', '수취가격'];
    revenueItems.forEach(itemName => {
        const nationalValue = nationalItemMap[itemName] || 0;
        const gangwonValue = gangwonItemMap[itemName] || 0;
        const difference = nationalValue - gangwonValue;
        const ratio = nationalValue > 0 ? ((gangwonValue / nationalValue) * 100) : 0;
        
        const nationalDisplay = nationalValue === 0 ? '-' : nationalValue.toLocaleString();
        const gangwonDisplay = gangwonValue === 0 ? '-' : gangwonValue.toLocaleString();
        const differenceDisplay = (Math.abs(difference) === 0 && nationalValue === 0 && gangwonValue === 0) ? '-' : Math.abs(difference).toLocaleString();
        const changeRate = ratio === 0 ? 0 : ratio - 100;
        const ratioDisplay = ratio === 0 ? '-' : 
            changeRate > 0 ? `▲ +${changeRate.toFixed(1)}%` : 
            changeRate < 0 ? `▼ ${changeRate.toFixed(1)}%` : `0.0%`;
            
        const diffColor = gangwonValue > nationalValue ? 'color: #dc2626;' : 'color: #1e40af;';
        const ratioColor = changeRate > 0 ? 'color: #dc2626;' : changeRate < 0 ? 'color: #1e40af;' : 'color: #64748b;';
        
        html += `
            <tr>
                <td>${itemName}</td>
                <td>${nationalDisplay}</td>
                <td>${gangwonDisplay}</td>
                <td style="${diffColor}">${differenceDisplay}</td>
                <td style="${ratioColor}">${ratioDisplay}</td>
            </tr>
        `;
    });
    
    // 중간재비 박스
    let nationalTotalMaterial = 0;
    let gangwonTotalMaterial = 0;
    
    // 현재 필터의 작목에 따른 중간재비 항목 결정
    let materialCostItems = [];
    if (compareFilters.cropGroup === '과수') {
        materialCostItems = [
            '과수원조성비', '보통(무기질)비료비', '부산물(유기질)비료비',
            '농약비', '수도광열비', '기타재료비', '소농구비',
            '대농구상각비', '영농시설상각비', '수리·유지비', '기타비용'
        ];
    } else {
        materialCostItems = [
            '종자·종묘비', '보통(무기질)비료비', '부산물(유기질)비료비',
            '농약비', '수도광열비', '기타재료비', '소농구비',
            '대농구상각비', '영농시설상각비', '수리·유지비', '기타비용'
        ];
    }
    
    materialCostItems.forEach(itemName => {
        const nationalValue = nationalItemMap[itemName] || 0;
        const gangwonValue = gangwonItemMap[itemName] || 0;
        nationalTotalMaterial += nationalValue;
        gangwonTotalMaterial += gangwonValue;
    });
    
    const materialDiff = nationalTotalMaterial - gangwonTotalMaterial;
    const materialRatio = nationalTotalMaterial > 0 ? ((gangwonTotalMaterial / nationalTotalMaterial) * 100) : 0;
    
    const materialDiffColor = gangwonTotalMaterial > nationalTotalMaterial ? 'color: #dc2626;' : 'color: #1e40af;';
    const materialRatioColor = materialRatio > 100 ? 'color: #dc2626;' : 'color: #1e40af;';
    
    const nationalTotalMaterialDisplay = nationalTotalMaterial === 0 ? '-' : nationalTotalMaterial.toLocaleString();
    const gangwonTotalMaterialDisplay = gangwonTotalMaterial === 0 ? '-' : gangwonTotalMaterial.toLocaleString();
    const materialDiffDisplay = Math.abs(materialDiff) === 0 ? '-' : Math.abs(materialDiff).toLocaleString();
    const materialRatioDisplay = materialRatio === 0 ? '-' : `${materialRatio.toFixed(1)}%`;
    
    html += `
        <tr>
            <td style="background-color: #f8fafc; font-weight: bold;">중간재비</td>
            <td style="background-color: #f8fafc; font-weight: bold;">${nationalTotalMaterialDisplay}</td>
            <td style="background-color: #f8fafc; font-weight: bold;">${gangwonTotalMaterialDisplay}</td>
            <td style="background-color: #f8fafc; font-weight: bold; ${materialDiffColor}">${materialDiffDisplay}</td>
            <td style="background-color: #f8fafc; font-weight: bold; ${materialRatioColor}">${materialRatioDisplay}</td>
        </tr>
    `;
    
    materialCostItems.forEach(itemName => {
        const nationalValue = nationalItemMap[itemName] || 0;
        const gangwonValue = gangwonItemMap[itemName] || 0;
        const difference = nationalValue - gangwonValue;
        const ratio = nationalValue > 0 ? ((gangwonValue / nationalValue) * 100) : 0;
        
        const materialItemDiffColor = gangwonValue > nationalValue ? 'color: #dc2626;' : 'color: #1e40af;';
        const materialItemRatioColor = ratio > 100 ? 'color: #dc2626;' : 'color: #1e40af;';
        
        const nationalDisplay = nationalValue === 0 ? '-' : nationalValue.toLocaleString();
        const gangwonDisplay = gangwonValue === 0 ? '-' : gangwonValue.toLocaleString();
        const differenceDisplay = (Math.abs(difference) === 0 && nationalValue === 0 && gangwonValue === 0) ? '-' : Math.abs(difference).toLocaleString();
        const changeRate = ratio === 0 ? 0 : ratio - 100;
        const ratioDisplay = ratio === 0 ? '-' : 
            changeRate > 0 ? `▲ +${changeRate.toFixed(1)}%` : 
            changeRate < 0 ? `▼ ${changeRate.toFixed(1)}%` : `0.0%`;
        
        html += `
            <tr>
                <td>${itemName}</td>
                <td>${nationalDisplay}</td>
                <td>${gangwonDisplay}</td>
                <td style="${materialItemDiffColor}">${differenceDisplay}</td>
                <td style="${materialItemRatioColor}">${ratioDisplay}</td>
            </tr>
        `;
    });
    
    // 경영비 박스
    const nationalCost = nationalItemMap['경영비'] || 0;
    const gangwonCost = gangwonItemMap['경영비'] || 0;
    const costDiff = nationalCost - gangwonCost;
    const costRatio = nationalCost > 0 ? ((gangwonCost / nationalCost) * 100) : 0;
    
    const costDiffColor = gangwonCost > nationalCost ? 'color: #dc2626;' : 'color: #1e40af;';
    const costRatioColor = costRatio > 100 ? 'color: #dc2626;' : 'color: #1e40af;';
    
    const nationalCostDisplay = nationalCost === 0 ? '-' : nationalCost.toLocaleString();
    const gangwonCostDisplay = gangwonCost === 0 ? '-' : gangwonCost.toLocaleString();
    const costDiffDisplay = Math.abs(costDiff) === 0 ? '-' : Math.abs(costDiff).toLocaleString();
    const costRatioDisplay = costRatio === 0 ? '-' : `${costRatio.toFixed(1)}%`;
    
    html += `
        <tr>
            <td style="background-color: #f8fafc; font-weight: bold;">경영비</td>
            <td style="background-color: #f8fafc; font-weight: bold;">${nationalCostDisplay}</td>
            <td style="background-color: #f8fafc; font-weight: bold;">${gangwonCostDisplay}</td>
            <td style="background-color: #f8fafc; font-weight: bold; ${costDiffColor}">${costDiffDisplay}</td>
            <td style="background-color: #f8fafc; font-weight: bold; ${costRatioColor}">${costRatioDisplay}</td>
        </tr>
    `;
    
    const costItems = ['농기계·시설임차료', '토지임차료', '위탁영농비', '고용노동비'];
    costItems.forEach(itemName => {
        const nationalValue = nationalItemMap[itemName] || 0;
        const gangwonValue = gangwonItemMap[itemName] || 0;
        const difference = nationalValue - gangwonValue;
        const ratio = nationalValue > 0 ? ((gangwonValue / nationalValue) * 100) : 0;
        
        const nationalDisplay = nationalValue === 0 ? '-' : nationalValue.toLocaleString();
        const gangwonDisplay = gangwonValue === 0 ? '-' : gangwonValue.toLocaleString();
        const differenceDisplay = (Math.abs(difference) === 0 && nationalValue === 0 && gangwonValue === 0) ? '-' : Math.abs(difference).toLocaleString();
        const changeRate = ratio === 0 ? 0 : ratio - 100;
        const ratioDisplay = ratio === 0 ? '-' : 
            changeRate > 0 ? `▲ +${changeRate.toFixed(1)}%` : 
            changeRate < 0 ? `▼ ${changeRate.toFixed(1)}%` : `0.0%`;
        
        html += `
            <tr>
                <td>${itemName}</td>
                <td>${nationalDisplay}</td>
                <td>${gangwonDisplay}</td>
                <td style="${gangwonValue > nationalValue ? 'color: #dc2626;' : 'color: #1e40af;'}">${differenceDisplay}</td>
                <td style="${ratio > 100 ? 'color: #dc2626;' : 'color: #1e40af;'}">${ratioDisplay}</td>
            </tr>
        `;
    });
    
    // 생산비 박스
    const nationalProductionCost = nationalItemMap['생산비'] || 0;
    const gangwonProductionCost = gangwonItemMap['생산비'] || 0;
    const productionDiff = nationalProductionCost - gangwonProductionCost;
    const productionRatio = nationalProductionCost > 0 ? ((gangwonProductionCost / nationalProductionCost) * 100) : 0;
    
    const productionDiffColor = gangwonProductionCost > nationalProductionCost ? 'color: #dc2626;' : 'color: #1e40af;';
    const productionRatioColor = productionRatio > 100 ? 'color: #dc2626;' : 'color: #1e40af;';
    
    const nationalProductionCostDisplay = nationalProductionCost === 0 ? '-' : nationalProductionCost.toLocaleString();
    const gangwonProductionCostDisplay = gangwonProductionCost === 0 ? '-' : gangwonProductionCost.toLocaleString();
    const productionDiffDisplay = Math.abs(productionDiff) === 0 ? '-' : Math.abs(productionDiff).toLocaleString();
    const productionRatioDisplay = productionRatio === 0 ? '-' : `${productionRatio.toFixed(1)}%`;
    
    html += `
        <tr>
            <td style="background-color: #f8fafc; font-weight: bold;">생산비</td>
            <td style="background-color: #f8fafc; font-weight: bold;">${nationalProductionCostDisplay}</td>
            <td style="background-color: #f8fafc; font-weight: bold;">${gangwonProductionCostDisplay}</td>
            <td style="background-color: #f8fafc; font-weight: bold; ${productionDiffColor}">${productionDiffDisplay}</td>
            <td style="background-color: #f8fafc; font-weight: bold; ${productionRatioColor}">${productionRatioDisplay}</td>
        </tr>
    `;
    
    const productionItems = ['자가노동비', '유동자본용역비', '고정자본용역비', '토지자본용역비'];
    productionItems.forEach(itemName => {
        const nationalValue = nationalItemMap[itemName] || 0;
        const gangwonValue = gangwonItemMap[itemName] || 0;
        const difference = nationalValue - gangwonValue;
        const ratio = nationalValue > 0 ? ((gangwonValue / nationalValue) * 100) : 0;
        
        const nationalDisplay = nationalValue === 0 ? '-' : nationalValue.toLocaleString();
        const gangwonDisplay = gangwonValue === 0 ? '-' : gangwonValue.toLocaleString();
        const differenceDisplay = (Math.abs(difference) === 0 && nationalValue === 0 && gangwonValue === 0) ? '-' : Math.abs(difference).toLocaleString();
        const changeRate = ratio === 0 ? 0 : ratio - 100;
        const ratioDisplay = ratio === 0 ? '-' : 
            changeRate > 0 ? `▲ +${changeRate.toFixed(1)}%` : 
            changeRate < 0 ? `▼ ${changeRate.toFixed(1)}%` : `0.0%`;
        
        html += `
            <tr>
                <td>${itemName}</td>
                <td>${nationalDisplay}</td>
                <td>${gangwonDisplay}</td>
                <td style="${gangwonValue > nationalValue ? 'color: #dc2626;' : 'color: #1e40af;'}">${differenceDisplay}</td>
                <td style="${ratio > 100 ? 'color: #dc2626;' : 'color: #1e40af;'}">${ratioDisplay}</td>
            </tr>
        `;
    });
    
    // 소득 및 소득률
    const nationalIncome = nationalItemMap['소득'] || 0;
    const gangwonIncome = gangwonItemMap['소득'] || 0;
    const incomeDiff = nationalIncome - gangwonIncome;
    const incomeRatio = nationalIncome > 0 ? ((gangwonIncome / nationalIncome) * 100) : 0;
    
    const nationalIncomeRate = nationalItemMap['소득률'] || 0;
    const gangwonIncomeRate = gangwonItemMap['소득률'] || 0;
    const rateDiff = nationalIncomeRate - gangwonIncomeRate;
    const rateRatio = nationalIncomeRate > 0 ? ((gangwonIncomeRate / nationalIncomeRate) * 100) : 0;
    
    const incomeChangeRate = incomeRatio === 0 ? 0 : incomeRatio - 100;
    const rateChangeRate = rateRatio === 0 ? 0 : rateRatio - 100;
    
    const incomeDiffColor = gangwonIncome > nationalIncome ? 'color: #dc2626;' : 'color: #1e40af;';
    const incomeRatioColor = incomeChangeRate > 0 ? 'color: #dc2626;' : incomeChangeRate < 0 ? 'color: #1e40af;' : 'color: #64748b;';
    const rateCompareColor = gangwonIncomeRate > nationalIncomeRate ? 'color: #dc2626;' : 'color: #1e40af;';
    const rateRatioColor = rateChangeRate > 0 ? 'color: #dc2626;' : rateChangeRate < 0 ? 'color: #1e40af;' : 'color: #64748b;';
    
    const nationalIncomeDisplay = nationalIncome === 0 ? '-' : nationalIncome.toLocaleString();
    const gangwonIncomeDisplay = gangwonIncome === 0 ? '-' : gangwonIncome.toLocaleString();
    const incomeDiffDisplay = Math.abs(incomeDiff) === 0 ? '-' : Math.abs(incomeDiff).toLocaleString();
    
    const incomeRatioDisplay = incomeRatio === 0 ? '-' : 
        incomeChangeRate > 0 ? `▲ +${incomeChangeRate.toFixed(1)}%` : 
        incomeChangeRate < 0 ? `▼ ${incomeChangeRate.toFixed(1)}%` : `0.0%`;
    
    const nationalIncomeRateDisplay = nationalIncomeRate === 0 ? '-' : `${nationalIncomeRate.toFixed(1)}%`;
    const gangwonIncomeRateDisplay = gangwonIncomeRate === 0 ? '-' : `${gangwonIncomeRate.toFixed(1)}%`;
    const rateDiffDisplay = Math.abs(rateDiff) === 0 ? '-' : `${Math.abs(rateDiff).toFixed(1)}%p`;
    
    const rateRatioDisplay = rateRatio === 0 ? '-' : 
        rateChangeRate > 0 ? `▲ +${rateChangeRate.toFixed(1)}%` : 
        rateChangeRate < 0 ? `▼ ${rateChangeRate.toFixed(1)}%` : `0.0%`;
    
    html += `
        <tr>
            <td style="background-color: #f8fafc; font-weight: bold;">소득</td>
            <td style="background-color: #f8fafc; font-weight: bold;">${nationalIncomeDisplay}</td>
            <td style="background-color: #f8fafc; font-weight: bold;">${gangwonIncomeDisplay}</td>
            <td style="background-color: #f8fafc; font-weight: bold; ${incomeDiffColor}">${incomeDiffDisplay}</td>
            <td style="background-color: #f8fafc; font-weight: bold; ${incomeRatioColor}">${incomeRatioDisplay}</td>
        </tr>
        <tr>
            <td style="background-color: #f8fafc; font-weight: bold;">소득률</td>
            <td style="background-color: #f8fafc; font-weight: bold;">${nationalIncomeRateDisplay}</td>
            <td style="background-color: #f8fafc; font-weight: bold;">${gangwonIncomeRateDisplay}</td>
            <td style="background-color: #f8fafc; font-weight: bold; ${rateCompareColor}">${rateDiffDisplay}</td>
            <td style="background-color: #f8fafc; font-weight: bold; ${rateRatioColor}">${rateRatioDisplay}</td>
        </tr>
    `;
    
    // 추가 주요 지표들 (소득률 아래 위치)
    const mainIndicators = ['부가가치', '부가가치율', '노동생산성', '자본생산성', '토지생산성', 'kg당 생산비', 'kg당 경영비'];
    mainIndicators.forEach(itemName => {
        const nationalValue = nationalItemMap[itemName] || 0;
        const gangwonValue = gangwonItemMap[itemName] || 0;
        const difference = nationalValue - gangwonValue;
        const ratio = nationalValue > 0 ? ((gangwonValue / nationalValue) * 100) : 0;
        const changeRate = ratio === 0 ? 0 : ratio - 100;
        
        let nationalDisplay, gangwonDisplay;
        if (itemName === '부가가치율') {
            nationalDisplay = nationalValue === 0 ? '-' : `${nationalValue.toFixed(1)}%`;
            gangwonDisplay = gangwonValue === 0 ? '-' : `${gangwonValue.toFixed(1)}%`;
        } else if (itemName === '자본생산성') {
            nationalDisplay = nationalValue === 0 ? '-' : nationalValue.toFixed(2);
            gangwonDisplay = gangwonValue === 0 ? '-' : gangwonValue.toFixed(2);
        } else {
            nationalDisplay = nationalValue === 0 ? '-' : nationalValue.toLocaleString();
            gangwonDisplay = gangwonValue === 0 ? '-' : gangwonValue.toLocaleString();
        }
        
        const differenceDisplay = (Math.abs(difference) === 0 && nationalValue === 0 && gangwonValue === 0) ? '-' : Math.abs(difference).toLocaleString();
        const ratioDisplay = ratio === 0 ? '-' : 
            changeRate > 0 ? `▲ +${changeRate.toFixed(1)}%` : 
            changeRate < 0 ? `▼ ${changeRate.toFixed(1)}%` : `0.0%`;
            
        const diffColor = gangwonValue > nationalValue ? 'color: #dc2626;' : 'color: #1e40af;';
        const ratioColor = changeRate > 0 ? 'color: #dc2626;' : changeRate < 0 ? 'color: #1e40af;' : 'color: #64748b;';
        
        // 노지풋옥수수일 때 kg당 -> 개당으로 표시
        let displayName = itemName;
        if (compareFilters.crop === '노지풋옥수수') {
            displayName = itemName.replace('kg당', '개당');
        }
        
        html += `
            <tr>
                <td style="background-color: #f8fafc; font-weight: bold;">${displayName}</td>
                <td style="background-color: #f8fafc; font-weight: bold;">${nationalDisplay}</td>
                <td style="background-color: #f8fafc; font-weight: bold;">${gangwonDisplay}</td>
                <td style="background-color: #f8fafc; font-weight: bold; ${diffColor}">${differenceDisplay}</td>
                <td style="background-color: #f8fafc; font-weight: bold; ${ratioColor}">${ratioDisplay}</td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html || '<tr><td colspan="5">비교 데이터가 없습니다.</td></tr>';
}

// 차트 타이틀 업데이트 함수
function updateCompareChartTitle(titleId, categoryKorean) {
    const titleElement = document.getElementById(titleId);
    if (!titleElement) return;
    
    // 작목상세 정보 가져오기
    let cropDetail = '';
    if (compareFilters.crop) {
        cropDetail = compareFilters.crop + ' ';
    } else if (compareFilters.cropGroup) {
        cropDetail = compareFilters.cropGroup + ' ';
    }
    
    titleElement.textContent = `${cropDetail}${categoryKorean} 비교`;
}

function updateCompareCharts() {
    console.log('비교차트 업데이트 시작 - 현재 작목:', compareFilters.crop);
    
    // 드롭다운 옵션 텍스트 업데이트
    updateDropdownOptions();
    
    // 현재 선택된 드롭다운 값으로 차트 업데이트 (년도는 각 함수에서 동적으로 결정)
    const dataSelect = document.getElementById('compareDataSelect');
    const productivitySelect = document.getElementById('compareProductivitySelect');
    const costSelect = document.getElementById('compareCostSelect');
    const laborSelect = document.getElementById('compareLaborSelect');
    
    updateCompareDataChart(dataSelect?.value || 'totalIncome');
    updateCompareProductivityChart(productivitySelect?.value || 'laborProductivity');
    updateCompareCostChart(costSelect?.value || 'intermediateCost');
    updateCompareLaborChart(laborSelect?.value || 'totalLaborTime');
    updateCompareCropIncomeTable();
    
    console.log('비교차트 업데이트 완료');
}

// 비교 차트 datalabels 공통 함수들
function getDynamicAlign(context) {
    const datasets = context.chart.data.datasets;
    const compareValue = context.dataset.data[context.dataIndex];
    
    // 같은 인덱스의 다른 데이터셋 값 찾기 (전국 vs 강원)
    let otherValue = 0;
    datasets.forEach((dataset, idx) => {
        if (idx !== context.datasetIndex) {
            otherValue = dataset.data[context.dataIndex];
        }
    });
    
    // 각 포인트별로 값 비교: 큰 값은 위쪽, 작은 값은 아래쪽
    if (compareValue > otherValue) {
        return 'top';  // 현재 값이 더 크면 위쪽
    } else if (compareValue < otherValue) {
        return 'bottom';  // 현재 값이 더 작으면 아래쪽
    } else {
        // 값이 같을 때는 첫 번째 데이터셋(전국)은 위, 두 번째(강원)는 아래
        return context.datasetIndex === 0 ? 'top' : 'bottom';
    }
}

function getDynamicOffset(context) {
    const datasets = context.chart.data.datasets;
    const compareValue = context.dataset.data[context.dataIndex];
    
    let otherValue = 0;
    datasets.forEach((dataset, idx) => {
        if (idx !== context.datasetIndex) {
            otherValue = dataset.data[context.dataIndex];
        }
    });
    
    const diff = Math.abs(compareValue - otherValue);
    const maxValue = Math.max(compareValue, otherValue);
    
    // 값이 비슷할 때 (10% 이내 차이) 더 큰 간격으로 분리
    if (diff < maxValue * 0.1) {
        return 20;
    }
    
    // 값이 다를 때 기본 간격
    return 10;
}

// 비교 차트 함수들
function updateCompareDataChart(category = 'totalIncome') {
    // 카테고리 매핑
    const categoryMapping = {
        'totalIncome': '총수입',
        'income': '소득',
        'incomeRate': '소득률',
        'mainProductQuantity': '주산물수량',
        'receivedPrice': '수취가격'
    };
    
    const dataCategory = categoryMapping[category] || '총수입';
    
    // 차트 타이틀 업데이트
    updateCompareChartTitle('compareDataTitle', dataCategory);
    
    // 단위 업데이트
    const compareDataUnit = document.getElementById('compareDataUnit');
    if (compareDataUnit) {
        let unit = '';
        switch(category) {
            case 'totalIncome':
            case 'income':
                unit = '원/10a';
                break;
            case 'incomeRate':
                unit = '%';
                break;
            case 'mainProductQuantity':
                unit = compareFilters.crop === '노지풋옥수수' ? '개/10a' : 'kg/10a';
                break;
            case 'receivedPrice':
                unit = compareFilters.crop === '노지풋옥수수' ? '원/개' : '원/kg';
                break;
        }
        compareDataUnit.textContent = unit;
    }
    
    // 현재 필터 조건에 맞는 데이터가 있는 년도들을 동적으로 추출
    const availableYears = new Set();
    
    csvData.forEach(row => {
        if (row.category === dataCategory &&
            (row.region === '전국' || row.region === '강원') &&
            (!compareFilters.cropGroup || row.cropGroup === compareFilters.cropGroup) &&
            (!compareFilters.crop || row.crop === compareFilters.crop) &&
            row.value > 0) {
            availableYears.add(row.year);
        }
    });
    
    // 년도를 정렬
    const years = Array.from(availableYears).sort();
    
    if (years.length === 0) {
        // 데이터가 없으면 차트를 비움
        const ctx = document.getElementById('compareDataChart')?.getContext('2d');
        if (ctx && charts['compareDataChart']) {
            charts['compareDataChart'].destroy();
        }
        return;
    }
    
    const nationalValues = years.map(y => {
        const match = csvData.find(row =>
            row.category === dataCategory &&
            row.year === y &&
            row.region === '전국' &&
            (!compareFilters.cropGroup || row.cropGroup === compareFilters.cropGroup) &&
            (!compareFilters.crop || row.crop === compareFilters.crop)
        );
        return match ? match.value : 0;
    });

    const gangwonValues = years.map(y => {
        const match = csvData.find(row =>
            row.category === dataCategory &&
            row.year === y &&
            row.region === '강원' &&
            (!compareFilters.cropGroup || row.cropGroup === compareFilters.cropGroup) &&
            (!compareFilters.crop || row.crop === compareFilters.crop)
        );
        return match ? match.value : 0;
    });

    const maxValue = Math.max(...nationalValues, ...gangwonValues);
    const yAxisMax = maxValue * 1.4;

    const ctx = document.getElementById('compareDataChart')?.getContext('2d');
    if (!ctx) return;
    
    if (charts['compareDataChart']) charts['compareDataChart'].destroy();

    const nationalGradient = ctx.createLinearGradient(0, 0, 0, 400);
    nationalGradient.addColorStop(0, 'rgba(29, 78, 216, 0.8)');
    nationalGradient.addColorStop(1, 'rgba(59, 130, 246, 0.3)');
    
    const gangwonGradient = ctx.createLinearGradient(0, 0, 0, 400);
    gangwonGradient.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
    gangwonGradient.addColorStop(1, 'rgba(147, 197, 253, 0.3)');

    charts['compareDataChart'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years.map(y => y + '년'),
            datasets: [{
                label: '전국',
                data: nationalValues,
                borderColor: '#1d4ed8',
                backgroundColor: 'transparent',
                borderWidth: 4,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: '#1d4ed8',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 3,
                tension: 0.4,
                fill: false,
                datalabels: {
                    anchor: 'end',
                    align: getDynamicAlign,
                    offset: getDynamicOffset,
                    formatter: value => value.toLocaleString(),
                    font: { size: 12, weight: 'bold' },
                    color: '#1d4ed8'
                }
            }, {
                label: '강원',
                data: gangwonValues,
                borderColor: '#3b82f6',
                backgroundColor: 'transparent',
                borderWidth: 4,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: '#3b82f6',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 3,
                tension: 0.4,
                fill: false,
                datalabels: {
                    anchor: 'end',
                    align: getDynamicAlign,
                    offset: getDynamicOffset,
                    formatter: value => value.toLocaleString(),
                    font: { size: 12, weight: 'bold' },
                    color: '#3b82f6'
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    left: 30,
                    right: 30,
                    top: 5,
                    bottom: 5
                }
            },
            plugins: { 
                legend: { 
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 12,
                        color: '#1f2937',
                        font: { size: 12, weight: '600' }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(30, 64, 175, 0.95)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#1e40af',
                    borderWidth: 2,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            let unit = '';
                            switch(category) {
                                case 'totalIncome':
                                case 'income':
                                    unit = '원/10a';
                                    break;
                                case 'incomeRate':
                                    unit = '%';
                                    break;
                                case 'mainProductQuantity':
                                    unit = compareFilters.crop === '노지풋옥수수' ? '개/10a' : 'kg/10a';
                                    break;
                                case 'receivedPrice':
                                    unit = compareFilters.crop === '노지풋옥수수' ? '원/개' : '원/kg';
                                    break;
                            }
                            return context.dataset.label + ': ' + context.parsed.y.toLocaleString() + unit;
                        }
                    }
                },
                datalabels: {
                    display: true
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 12, weight: 'bold' },
                        color: '#1f2937'
                    }
                },
                y: {
                    display: false,
                    beginAtZero: true,
                    max: yAxisMax,
                    grid: { display: false }
                }
            }
        }
    });
}

// 기존 함수명 호환성을 위한 래퍼
function updateCompareTotalIncomeChart() {
    updateCompareDataChart('totalIncome');
}

function updateCompareProductivityChart(category = 'laborProductivity') {
    // 카테고리 매핑
    const categoryMapping = {
        'laborProductivity': '노동생산성',
        'capitalProductivity': '자본생산성',
        'landProductivity': '토지생산성'
    };
    
    const dataCategory = categoryMapping[category] || '노동생산성';
    
    // 차트 타이틀 업데이트
    updateCompareChartTitle('compareProductivityTitle', dataCategory);
    
    // 단위 업데이트
    const compareProductivityUnit = document.getElementById('compareProductivityUnit');
    if (compareProductivityUnit) {
        let unit = '';
        switch(category) {
            case 'laborProductivity':
                unit = '원/시간';
                break;
            case 'capitalProductivity':
                unit = '%';
                break;
            case 'landProductivity':
                unit = '원/3.3㎡';
                break;
        }
        compareProductivityUnit.textContent = unit;
    }
    
    // 현재 필터 조건에 맞는 데이터가 있는 년도들을 동적으로 추출
    const availableYears = new Set();
    
    csvData.forEach(row => {
        if (row.category === dataCategory &&
            (row.region === '전국' || row.region === '강원') &&
            (!compareFilters.cropGroup || row.cropGroup === compareFilters.cropGroup) &&
            (!compareFilters.crop || row.crop === compareFilters.crop) &&
            row.value > 0) {
            availableYears.add(row.year);
        }
    });
    
    // 년도를 정렬
    const years = Array.from(availableYears).sort();
    
    if (years.length === 0) {
        // 데이터가 없으면 차트를 비움
        const ctx = document.getElementById('compareProductivityChart')?.getContext('2d');
        if (ctx && charts['compareProductivityChart']) {
            charts['compareProductivityChart'].destroy();
        }
        return;
    }
    
    const nationalValues = years.map(y => {
        const match = csvData.find(row =>
            row.category === dataCategory &&
            row.year === y &&
            row.region === '전국' &&
            (!compareFilters.cropGroup || row.cropGroup === compareFilters.cropGroup) &&
            (!compareFilters.crop || row.crop === compareFilters.crop)
        );
        return match ? match.value : 0;
    });

    const gangwonValues = years.map(y => {
        const match = csvData.find(row =>
            row.category === dataCategory &&
            row.year === y &&
            row.region === '강원' &&
            (!compareFilters.cropGroup || row.cropGroup === compareFilters.cropGroup) &&
            (!compareFilters.crop || row.crop === compareFilters.crop)
        );
        return match ? match.value : 0;
    });

    const maxValue = Math.max(...nationalValues, ...gangwonValues);
    const yAxisMax = maxValue * 1.4;

    const ctx = document.getElementById('compareProductivityChart')?.getContext('2d');
    if (!ctx) return;
    
    if (charts['compareProductivityChart']) charts['compareProductivityChart'].destroy();

    const nationalGradient = ctx.createLinearGradient(0, 0, 0, 400);
    nationalGradient.addColorStop(0, 'rgba(29, 78, 216, 0.8)');
    nationalGradient.addColorStop(1, 'rgba(59, 130, 246, 0.3)');
    
    const gangwonGradient = ctx.createLinearGradient(0, 0, 0, 400);
    gangwonGradient.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
    gangwonGradient.addColorStop(1, 'rgba(147, 197, 253, 0.3)');

    charts['compareProductivityChart'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years.map(y => y + '년'),
            datasets: [{
                label: '전국',
                data: nationalValues,
                borderColor: '#1d4ed8',
                backgroundColor: 'transparent',
                borderWidth: 4,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: '#1d4ed8',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 3,
                tension: 0.4,
                fill: false,
                datalabels: {
                    anchor: 'end',
                    align: getDynamicAlign,
                    offset: getDynamicOffset,
                    formatter: value => value.toLocaleString(),
                    font: { size: 12, weight: 'bold' },
                    color: '#1d4ed8'
                }
            }, {
                label: '강원',
                data: gangwonValues,
                borderColor: '#3b82f6',
                backgroundColor: 'transparent',
                borderWidth: 4,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: '#3b82f6',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 3,
                tension: 0.4,
                fill: false,
                datalabels: {
                    anchor: 'end',
                    align: getDynamicAlign,
                    offset: getDynamicOffset,
                    formatter: value => value.toLocaleString(),
                    font: { size: 12, weight: 'bold' },
                    color: '#3b82f6'
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    left: 30,
                    right: 30,
                    top: 5,
                    bottom: 5
                }
            },
            plugins: { 
                legend: { 
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 12,
                        color: '#1f2937',
                        font: { size: 12, weight: '600' }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(30, 64, 175, 0.95)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#1e40af',
                    borderWidth: 2,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            let unit = '';
                            switch(category) {
                                case 'laborProductivity':
                                    unit = '원/시간';
                                    break;
                                case 'capitalProductivity':
                                    unit = '%';
                                    break;
                                case 'landProductivity':
                                    unit = '원/3.3㎡';
                                    break;
                            }
                            return context.dataset.label + ': ' + context.parsed.y.toLocaleString() + unit;
                        }
                    }
                },
                datalabels: {
                    display: true
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 12, weight: 'bold' },
                        color: '#1f2937'
                    }
                },
                y: {
                    display: false,
                    beginAtZero: true,
                    max: yAxisMax,
                    grid: { display: false }
                }
            }
        }
    });
}

// 기존 함수명 호환성을 위한 래퍼
function updateCompareManagementCostChart() {
    updateCompareProductivityChart('laborProductivity');
}

function updateCompareCostChart(category = 'intermediateCost') {
    // 카테고리 매핑
    const categoryMapping = {
        'intermediateCost': '중간재비',
        'managementCost': '경영비',
        'productionCost': '생산비',
        'managementCostPerKg': 'kg당 경영비',
        'costPerKg': 'kg당 생산비'
    };
    
    const dataCategory = categoryMapping[category] || '중간재비';
    
    // 타이틀 표시용 카테고리 (노지풋옥수수일 때만 개당으로 표시)
    let displayCategory = dataCategory;
    if (compareFilters.crop === '노지풋옥수수') {
        displayCategory = dataCategory.replace('kg당', '개당');
    }
    
    // 차트 타이틀 업데이트
    updateCompareChartTitle('compareCostTitle', displayCategory);
    
    // 단위 업데이트
    const compareCostUnit = document.getElementById('compareCostUnit');
    if (compareCostUnit) {
        let unit = '';
        switch(category) {
            case 'intermediateCost':
            case 'managementCost':
            case 'productionCost':
                unit = '원/10a';
                break;
            case 'managementCostPerKg':
            case 'costPerKg':
                unit = compareFilters.crop === '노지풋옥수수' ? '원/개' : '원/kg';
                break;
        }
        compareCostUnit.textContent = unit;
    }
    
    // 현재 필터 조건에 맞는 데이터가 있는 년도들을 동적으로 추출
    const availableYears = new Set();
    
    csvData.forEach(row => {
        if (row.category === dataCategory &&
            (row.region === '전국' || row.region === '강원') &&
            (!compareFilters.cropGroup || row.cropGroup === compareFilters.cropGroup) &&
            (!compareFilters.crop || row.crop === compareFilters.crop) &&
            row.value > 0) {
            availableYears.add(row.year);
        }
    });
    
    // 년도를 정렬
    const years = Array.from(availableYears).sort();
    
    if (years.length === 0) {
        // 데이터가 없으면 차트를 비움
        const ctx = document.getElementById('compareCostChart')?.getContext('2d');
        if (ctx && charts['compareCostChart']) {
            charts['compareCostChart'].destroy();
        }
        return;
    }
    
    const nationalValues = years.map(y => {
        const match = csvData.find(row =>
            row.category === dataCategory &&
            row.year === y &&
            row.region === '전국' &&
            (!compareFilters.cropGroup || row.cropGroup === compareFilters.cropGroup) &&
            (!compareFilters.crop || row.crop === compareFilters.crop)
        );
        return match ? match.value : 0;
    });

    const gangwonValues = years.map(y => {
        const match = csvData.find(row =>
            row.category === dataCategory &&
            row.year === y &&
            row.region === '강원' &&
            (!compareFilters.cropGroup || row.cropGroup === compareFilters.cropGroup) &&
            (!compareFilters.crop || row.crop === compareFilters.crop)
        );
        return match ? match.value : 0;
    });

    const maxValue = Math.max(...nationalValues, ...gangwonValues);
    const yAxisMax = maxValue * 1.4;

    const ctx = document.getElementById('compareCostChart')?.getContext('2d');
    if (!ctx) return;
    
    if (charts['compareCostChart']) charts['compareCostChart'].destroy();

    const nationalGradient = ctx.createLinearGradient(0, 0, 0, 400);
    nationalGradient.addColorStop(0, 'rgba(29, 78, 216, 0.8)');
    nationalGradient.addColorStop(1, 'rgba(59, 130, 246, 0.3)');
    
    const gangwonGradient = ctx.createLinearGradient(0, 0, 0, 400);
    gangwonGradient.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
    gangwonGradient.addColorStop(1, 'rgba(147, 197, 253, 0.3)');

    charts['compareCostChart'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years.map(y => y + '년'),
            datasets: [{
                label: '전국',
                data: nationalValues,
                borderColor: '#1d4ed8',
                backgroundColor: 'transparent',
                borderWidth: 4,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: '#1d4ed8',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 3,
                tension: 0.4,
                fill: false,
                datalabels: {
                    anchor: 'end',
                    align: getDynamicAlign,
                    offset: getDynamicOffset,
                    formatter: value => value.toLocaleString(),
                    font: { size: 12, weight: 'bold' },
                    color: '#1d4ed8'
                }
            }, {
                label: '강원',
                data: gangwonValues,
                borderColor: '#3b82f6',
                backgroundColor: 'transparent',
                borderWidth: 4,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: '#3b82f6',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 3,
                tension: 0.4,
                fill: false,
                datalabels: {
                    anchor: 'end',
                    align: getDynamicAlign,
                    offset: getDynamicOffset,
                    formatter: value => value.toLocaleString(),
                    font: { size: 12, weight: 'bold' },
                    color: '#3b82f6'
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    left: 30,
                    right: 30,
                    top: 5,
                    bottom: 5
                }
            },
            plugins: { 
                legend: { 
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 12,
                        color: '#1f2937',
                        font: { size: 12, weight: '600' }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(30, 64, 175, 0.95)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#1e40af',
                    borderWidth: 2,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            let unit = '';
                            if (category === 'intermediateCost' || category === 'managementCost' || category === 'productionCost') {
                                unit = '원/10a';
                            } else if (category === 'managementCostPerKg' || category === 'costPerKg') {
                                unit = compareFilters.crop === '노지풋옥수수' ? '원/개' : '원/kg';
                            }
                            return context.dataset.label + ': ' + context.parsed.y.toLocaleString() + unit;
                        }
                    }
                },
                datalabels: {
                    display: true
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 12, weight: 'bold' },
                        color: '#1f2937'
                    }
                },
                y: {
                    display: false,
                    beginAtZero: true,
                    max: yAxisMax,
                    grid: { display: false }
                }
            }
        }
    });
}

// 기존 함수명 호환성을 위한 래퍼
function updateCompareIncomeRateChart() {
    updateCompareCostChart('intermediateCost');
}

function updateCompareSelfLaborChart() {
    const nationalMale = csvData.find(i => 
        i.category === '자가노동시간(남)' && 
        i.region === '전국' &&
        i.year === compareFilters.year &&
        (!compareFilters.cropGroup || i.cropGroup === compareFilters.cropGroup) &&
        (!compareFilters.crop || i.crop === compareFilters.crop)
    )?.value || 0;
    
    const nationalFemale = csvData.find(i => 
        i.category === '자가노동시간(여)' && 
        i.region === '전국' &&
        i.year === compareFilters.year &&
        (!compareFilters.cropGroup || i.cropGroup === compareFilters.cropGroup) &&
        (!compareFilters.crop || i.crop === compareFilters.crop)
    )?.value || 0;
    
    const gangwonMale = csvData.find(i => 
        i.category === '자가노동시간(남)' && 
        i.region === '강원' &&
        i.year === compareFilters.year &&
        (!compareFilters.cropGroup || i.cropGroup === compareFilters.cropGroup) &&
        (!compareFilters.crop || i.crop === compareFilters.crop)
    )?.value || 0;
    
    const gangwonFemale = csvData.find(i => 
        i.category === '자가노동시간(여)' && 
        i.region === '강원' &&
        i.year === compareFilters.year &&
        (!compareFilters.cropGroup || i.cropGroup === compareFilters.cropGroup) &&
        (!compareFilters.crop || i.crop === compareFilters.crop)
    )?.value || 0;
    
    const ctx = document.getElementById('compareSelfLaborChart')?.getContext('2d');
    if (!ctx) return;
    
    if (charts['compareSelfLaborChart']) charts['compareSelfLaborChart'].destroy();
    
    charts['compareSelfLaborChart'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['남성', '여성'],
            datasets: [
                {
                    label: '전국',
                    data: [nationalMale, nationalFemale],
                    backgroundColor: 'rgba(30, 64, 175, 0.8)',
                    borderColor: '#1e40af',
                    borderWidth: 1
                },
                {
                    label: '강원',
                    data: [gangwonMale, gangwonFemale],
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    borderColor: '#dc2626',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value + '시간';
                        }
                    }
                }
            }
        }
    });
}

function updateCompareHiredLaborChart() {
    const nationalMale = csvData.find(i => 
        i.category === '고용노동시간(남)' && 
        i.region === '전국' &&
        i.year === compareFilters.year &&
        (!compareFilters.cropGroup || i.cropGroup === compareFilters.cropGroup) &&
        (!compareFilters.crop || i.crop === compareFilters.crop)
    )?.value || 0;
    
    const nationalFemale = csvData.find(i => 
        i.category === '고용노동시간(여)' && 
        i.region === '전국' &&
        i.year === compareFilters.year &&
        (!compareFilters.cropGroup || i.cropGroup === compareFilters.cropGroup) &&
        (!compareFilters.crop || i.crop === compareFilters.crop)
    )?.value || 0;
    
    const gangwonMale = csvData.find(i => 
        i.category === '고용노동시간(남)' && 
        i.region === '강원' &&
        i.year === compareFilters.year &&
        (!compareFilters.cropGroup || i.cropGroup === compareFilters.cropGroup) &&
        (!compareFilters.crop || i.crop === compareFilters.crop)
    )?.value || 0;
    
    const gangwonFemale = csvData.find(i => 
        i.category === '고용노동시간(여)' && 
        i.region === '강원' &&
        i.year === compareFilters.year &&
        (!compareFilters.cropGroup || i.cropGroup === compareFilters.cropGroup) &&
        (!compareFilters.crop || i.crop === compareFilters.crop)
    )?.value || 0;
    
    const ctx = document.getElementById('compareHiredLaborChart')?.getContext('2d');
    if (!ctx) return;
    
    if (charts['compareHiredLaborChart']) charts['compareHiredLaborChart'].destroy();
    
    charts['compareHiredLaborChart'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['남성', '여성'],
            datasets: [
                {
                    label: '전국',
                    data: [nationalMale, nationalFemale],
                    backgroundColor: 'rgba(30, 64, 175, 0.8)',
                    borderColor: '#1e40af',
                    borderWidth: 1
                },
                {
                    label: '강원',
                    data: [gangwonMale, gangwonFemale],
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    borderColor: '#dc2626',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value + '시간';
                        }
                    }
                }
            }
        }
    });
}

function updateCompareLaborChart(category = 'totalLaborTime') {
    // 카테고리 매핑
    const categoryMapping = {
        'totalLaborTime': '총노동시간',
        'selfLaborTime': '자가노동시간', 
        'hiredLaborTime': '고용노동시간'
    };
    
    const dataCategory = categoryMapping[category] || '총노동시간';
    
    // 차트 타이틀 업데이트
    updateCompareChartTitle('compareLaborTitle', dataCategory);
    
    // 현재 필터 조건에 맞는 데이터가 있는 년도들을 동적으로 추출
    const availableYears = new Set();
    
    csvData.forEach(row => {
        if (row.category === dataCategory &&
            (row.region === '전국' || row.region === '강원') &&
            (!compareFilters.cropGroup || row.cropGroup === compareFilters.cropGroup) &&
            (!compareFilters.crop || row.crop === compareFilters.crop) &&
            row.value > 0) {
            availableYears.add(row.year);
        }
    });
    
    // 년도를 정렬
    const years = Array.from(availableYears).sort();
    
    if (years.length === 0) {
        // 데이터가 없으면 차트를 비움
        const ctx = document.getElementById('compareLaborChart')?.getContext('2d');
        if (ctx && charts['compareLaborChart']) {
            charts['compareLaborChart'].destroy();
        }
        return;
    }
    
    const nationalValues = years.map(y => {
        const match = csvData.find(row =>
            row.category === dataCategory &&
            row.year === y &&
            row.region === '전국' &&
            (!compareFilters.cropGroup || row.cropGroup === compareFilters.cropGroup) &&
            (!compareFilters.crop || row.crop === compareFilters.crop)
        );
        return match ? match.value : 0;
    });

    const gangwonValues = years.map(y => {
        const match = csvData.find(row =>
            row.category === dataCategory &&
            row.year === y &&
            row.region === '강원' &&
            (!compareFilters.cropGroup || row.cropGroup === compareFilters.cropGroup) &&
            (!compareFilters.crop || row.crop === compareFilters.crop)
        );
        return match ? match.value : 0;
    });

    const maxValue = Math.max(...nationalValues, ...gangwonValues);
    const yAxisMax = maxValue * 1.4;

    const ctx = document.getElementById('compareLaborChart')?.getContext('2d');
    if (!ctx) return;
    
    if (charts['compareLaborChart']) charts['compareLaborChart'].destroy();

    const nationalGradient = ctx.createLinearGradient(0, 0, 0, 400);
    nationalGradient.addColorStop(0, 'rgba(29, 78, 216, 0.8)');
    nationalGradient.addColorStop(1, 'rgba(59, 130, 246, 0.3)');
    
    const gangwonGradient = ctx.createLinearGradient(0, 0, 0, 400);
    gangwonGradient.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
    gangwonGradient.addColorStop(1, 'rgba(147, 197, 253, 0.3)');

    charts['compareLaborChart'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years.map(y => y + '년'),
            datasets: [{
                label: '전국',
                data: nationalValues,
                borderColor: '#1d4ed8',
                backgroundColor: 'transparent',
                borderWidth: 4,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: '#1d4ed8',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 3,
                tension: 0.4,
                fill: false,
                datalabels: {
                    anchor: 'end',
                    align: getDynamicAlign,
                    offset: getDynamicOffset,
                    formatter: value => value.toLocaleString(),
                    font: { size: 12, weight: 'bold' },
                    color: '#1d4ed8'
                }
            }, {
                label: '강원',
                data: gangwonValues,
                borderColor: '#3b82f6',
                backgroundColor: 'transparent',
                borderWidth: 4,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: '#3b82f6',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 3,
                tension: 0.4,
                fill: false,
                datalabels: {
                    anchor: 'end',
                    align: getDynamicAlign,
                    offset: getDynamicOffset,
                    formatter: value => value.toLocaleString(),
                    font: { size: 12, weight: 'bold' },
                    color: '#3b82f6'
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    left: 30,
                    right: 30,
                    top: 5,
                    bottom: 5
                }
            },
            plugins: { 
                legend: { 
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 12,
                        color: '#1f2937',
                        font: { size: 12, weight: '600' }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(30, 64, 175, 0.95)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#1e40af',
                    borderWidth: 2,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            let unit = '시간/10a';
                            return context.dataset.label + ': ' + context.parsed.y.toLocaleString() + unit;
                        }
                    }
                },
                datalabels: {
                    display: true
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 12, weight: 'bold' },
                        color: '#1f2937'
                    }
                },
                y: {
                    display: false,
                    beginAtZero: true,
                    max: yAxisMax,
                    grid: { display: false }
                }
            }
        }
    });
}

// 기존 함수명 호환성을 위한 래퍼
function updateCompareAnnualLaborChart() {
    updateCompareLaborChart('totalLaborTime');
}

function updateCompareCropIncomeTable() {
    const tableBody = document.getElementById('compareCropIncomeTableBody');
    if (!tableBody) return;
    
    // 자체 드롭다운에서 작목군 필터 값 가져오기
    const cropGroupFilter = document.getElementById('compareIncomeCropGroupFilter');
    const selectedCropGroup = cropGroupFilter ? cropGroupFilter.value : 'all';
    
    // 제목 업데이트
    const titleElement = document.getElementById('compareCropIncomeTitle');
    if (titleElement) {
        const year = compareFilters.year || '2023';
        const cropGroupText = selectedCropGroup === 'all' ? '전체' : selectedCropGroup;
        titleElement.innerHTML = `${year}년 ${cropGroupText} 작목별 소득<button onclick="exportCompareIncomeTableToExcel()" class="excel-download-btn" title="엑셀 다운로드"></button>`;
    }
    
    const nationalCropData = csvData.filter(item => {
        return item.category === '소득' &&
               item.region === '전국' &&
               item.year === compareFilters.year &&
               (selectedCropGroup === 'all' || item.cropGroup === selectedCropGroup);
    });

    const gangwonCropData = csvData.filter(item => {
        return item.category === '소득' &&
               item.region === '강원' &&
               item.year === compareFilters.year &&
               (selectedCropGroup === 'all' || item.cropGroup === selectedCropGroup);
    });

    // 공통 작목들 찾기
    const nationalCrops = new Set(nationalCropData.map(item => item.crop));
    const gangwonCrops = new Set(gangwonCropData.map(item => item.crop));
    const commonCrops = [...nationalCrops].filter(crop => gangwonCrops.has(crop)).sort();

    // 테이블 데이터 구조화
    const tableData = commonCrops.map(crop => {
        const nationalItem = nationalCropData.find(i => i.crop === crop);
        const gangwonItem = gangwonCropData.find(i => i.crop === crop);
        
        const nationalValue = nationalItem ? nationalItem.value : 0;
        const gangwonValue = gangwonItem ? gangwonItem.value : 0;
        const difference = gangwonValue - nationalValue;
        
        return {
            crop,
            nationalValue,
            gangwonValue,
            difference
        };
    });
    
    // 원본 데이터 저장 (정렬용)
    compareOriginalTableData = [...tableData];
    
    // 정렬 이벤트 리스너 초기화
    setTimeout(() => {
        initializeCompareTableSorting();
    }, 100);
    
    // 기존 정렬 상태가 있으면 적용, 없으면 기본 정렬 (작목명 오름차순)
    if (compareCurrentSort.column) {
        sortCompareTableByColumn(compareCurrentSort.column);
    } else {
        tableData.sort((a, b) => a.crop.localeCompare(b.crop));
        renderCompareTableWithData(tableData);
    }
}

// ========== 애플리케이션 초기화 ==========

function initializeApp() {
    console.log('애플리케이션 초기화 중...');
    
    // 홈탭이 활성상태인지 확인하고 footer 표시 설정
    const homeTab = document.getElementById('home');
    if (homeTab && homeTab.classList.contains('active')) {
        document.body.classList.add('home-tab-active');
    }
    
    // 반응형 사이드바 초기화
    initResponsiveSidebar();
    
    // 생산성 차트 드롭다운 이벤트 리스너 추가
    const productivitySelector = document.getElementById('productivitySelector');
    if (productivitySelector) {
        productivitySelector.addEventListener('change', function() {
            const fixedYears = ['2019', '2020', '2021', '2022', '2023'];
            updateProductivityTitle();
            updateProductivityChart(fixedYears);
        });
    }

    // 단위당 비용 차트 드롭다운 이벤트 리스너 추가
    const costEfficiencySelector = document.getElementById('costEfficiencySelector');
    if (costEfficiencySelector) {
        costEfficiencySelector.addEventListener('change', function() {
            const fixedYears = ['2019', '2020', '2021', '2022', '2023'];
            updateCostEfficiencyTitle();
            updateCostEfficiencyChart(fixedYears);
        });
    }

    // 비교탭 데이터 차트 드롭다운 이벤트 리스너 추가
    const compareDataSelector = document.getElementById('compareDataSelect');
    if (compareDataSelector) {
        compareDataSelector.addEventListener('change', function() {
            updateCompareDataChart(this.value);
        });
    }

    // 비교탭 비용 차트 드롭다운 이벤트 리스너 추가
    const compareCostSelector = document.getElementById('compareCostSelect');
    if (compareCostSelector) {
        compareCostSelector.addEventListener('change', function() {
            updateCompareCostChart(this.value);
        });
    }

    // 비교탭 생산성 차트 드롭다운 이벤트 리스너 추가
    const compareProductivitySelector = document.getElementById('compareProductivitySelect');
    if (compareProductivitySelector) {
        compareProductivitySelector.addEventListener('change', function() {
            updateCompareProductivityChart(this.value);
        });
    }

    // 비교탭 노동시간 차트 드롭다운 이벤트 리스너 추가
    const compareLaborSelector = document.getElementById('compareLaborSelect');
    if (compareLaborSelector) {
        compareLaborSelector.addEventListener('change', function() {
            updateCompareLaborChart(this.value);
        });
    }
    
    // CSV 데이터 로드
    loadCSVFromGitHub();
    
    // Chart.js 플러그인 등록
    if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
        Chart.register(ChartDataLabels);
    }
}

// ========== 요약 탭 관리 ==========
let summaryFilters = {
    region: '강원',
    year: '2023' // 초기값, 데이터 로드 후 업데이트됨
};

function initializeSummaryFilters() {
    if (csvData.length === 0) return;

    // 최신 연도로 업데이트
    summaryFilters.year = getLatestYear();

    // 지역 필터 초기화 - HTML에서 이미 정의되어 있으므로 활성화 상태만 업데이트
    document.querySelectorAll('#summaryRegionFilter .summary-filter-btn').forEach(button => {
        const region = button.getAttribute('data-region');
        button.className = `summary-filter-btn ${region === summaryFilters.region ? 'active' : ''}`;
        button.addEventListener('click', () => updateSummaryRegionFilter(region));
    });

    // 년도 필터 초기화 - 내림차순 정렬 (2023, 2022, ..., 2019)
    const years = [...new Set(csvData.map(item => item.year))].sort((a, b) => b - a);
    const yearFilter = document.getElementById('summaryYearFilter');
    if (yearFilter) {
        yearFilter.innerHTML = '';
        years.forEach(year => {
            const button = document.createElement('button');
            button.className = `summary-filter-btn ${year === summaryFilters.year ? 'active' : ''}`;
            button.textContent = year;
            button.addEventListener('click', () => updateSummaryYearFilter(year));
            yearFilter.appendChild(button);
        });
    }

    // 새로운 요약탭 이벤트 리스너 초기화
    initializeSummaryEventListeners();

    updateSummaryDisplay();
}

// ========== 평년탭 필터 초기화 ==========

// 비교 모드 버튼 옵션 업데이트
function updateComparisonModeOptions() {
    const comparisonModeFilter = document.getElementById('comparisonModeFilter');
    if (!comparisonModeFilter) return;
    
    const latestYear = getLatestYear();
    
    const modes = [
        { value: 'gangwon-yearly-vs-current', label: `강원 평년 vs 강원 ${latestYear}년` },
        { value: 'national-vs-gangwon-yearly', label: '전국 평년 vs 강원 평년' },
        { value: 'national-yearly-vs-gangwon-current', label: `전국 평년 vs 강원 ${latestYear}년` },
        { value: 'national-yearly-vs-current', label: `전국 평년 vs 전국 ${latestYear}년` }
    ];
    
    comparisonModeFilter.innerHTML = modes.map(mode => 
        `<button class="yearly-filter-btn ${yearlyFilters.comparisonMode === mode.value ? 'active' : ''}" 
                 data-value="${mode.value}">${mode.label}</button>`
    ).join('');
    
    // 버튼 클릭 이벤트 리스너 추가
    comparisonModeFilter.querySelectorAll('.yearly-filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // 기존 active 제거
            comparisonModeFilter.querySelectorAll('.yearly-filter-btn').forEach(b => b.classList.remove('active'));
            // 새로운 active 추가
            this.classList.add('active');
            
            yearlyFilters.comparisonMode = this.dataset.value;
            yearlyFilters.cropGroup = ''; // 비교 모드 변경 시 초기화
            yearlyFilters.crop = '';
            updateYearlyCropGroups();
            updateYearlyAnalysisTitle();
        });
    });
}

// 분석표 헤더 업데이트
function updateYearlyAnalysisHeader() {
    const latestYear = getLatestYear();
    const yearlyAnalysisTableBody = document.getElementById('yearlyAnalysisTableBody');
    if (!yearlyAnalysisTableBody) return;
    
    const table = yearlyAnalysisTableBody.closest('table');
    if (!table) return;
    
    const headerRow = table.querySelector('thead tr');
    if (headerRow) {
        headerRow.innerHTML = `
            <th>지표명</th>
            <th>평년값</th>
            <th>${latestYear}년값</th>
            <th>증감</th>
            <th>증감률</th>
        `;
    }
}

function initializeYearlyFilters() {
    if (csvData2.length === 0) return;
    
    console.log('평년탭 필터 초기화 중...');
    
    // 비교 모드 드롭다운 옵션 업데이트
    updateComparisonModeOptions();
    
    // 분석표 헤더 업데이트
    updateYearlyAnalysisHeader();
    
    // 비교 모드 버튼 초기화는 updateComparisonModeOptions()에서 처리됨
    
    // 이벤트 리스너 초기화
    initializeYearlyEventListeners();
    
    // 작목군 필터 업데이트
    updateYearlyCropGroups();
    
    // 작목군 드롭다운 초기화
    initializeYearlyCropGroupFilter();
    
    // 분석표 타이틀 업데이트
    updateYearlyAnalysisTitle();
    
    // 작목별 소득 테이블 초기화
    updateYearlyCropIncomeTable();
    
    // TOP 5 리스트 초기화
    updateYearlyTop5List();
    
    // 전국 평년 TOP 5 리스트 초기화
    updateYearlyNationalTop5List();
    
    // 정렬 기능 초기화 (테이블 로딩 후)
    setTimeout(() => {
        initializeYearlyTableSorting();
    }, 300);
}

function initializeYearlyEventListeners() {
    // 작목군, 작목상세 필터는 이제 드롭다운으로 처리되어 별도 이벤트 리스너 불필요
}

// 비교 모드에 따른 작목군 필터 업데이트
function updateYearlyCropGroups() {
    const { regions, datasets } = getComparisonModeInfo(yearlyFilters.comparisonMode);
    
    // 모든 데이터셋에서 공통으로 있는 작목군만 표시
    let commonCropGroups = [];
    
    if (datasets.length === 1) {
        // 단일 데이터셋인 경우
        const dataset = datasets[0];
        const data = dataset.isYearly ? csvData2 : csvData;
        commonCropGroups = [...new Set(data.filter(item => 
            item.region === dataset.region
        ).map(item => item.cropGroup))].filter(group => group && group.trim() !== '').sort();
    } else {
        // 두 데이터셋 비교인 경우 교집합 찾기
        const sets = datasets.map(dataset => {
            const data = dataset.isYearly ? csvData2 : csvData;
            return new Set(data.filter(item => 
                item.region === dataset.region
            ).map(item => item.cropGroup).filter(group => group && group.trim() !== ''));
        });
        
        if (sets.length === 2) {
            commonCropGroups = [...sets[0]].filter(group => sets[1].has(group)).sort();
        }
    }
    
    const yearlyCropGroupSelect = document.getElementById('yearlyCropGroupSelect');
    if (yearlyCropGroupSelect) {
        yearlyCropGroupSelect.innerHTML = '';
        commonCropGroups.forEach((group, index) => {
            const isSelected = yearlyFilters.cropGroup === group || (!yearlyFilters.cropGroup && index === 0) ? 'selected' : '';
            yearlyCropGroupSelect.innerHTML += `<option value="${group}" ${isSelected}>${group}</option>`;
            // 첫 번째 항목을 기본값으로 설정
            if (!yearlyFilters.cropGroup && index === 0) {
                yearlyFilters.cropGroup = group;
            }
        });
        
        // 기존 이벤트 리스너 제거 후 새로 추가
        const newSelect = yearlyCropGroupSelect.cloneNode(true);
        yearlyCropGroupSelect.parentNode.replaceChild(newSelect, yearlyCropGroupSelect);
        
        newSelect.addEventListener('change', function() {
            yearlyFilters.cropGroup = this.value;
            yearlyFilters.crop = ''; // 작목군 변경 시 작목상세 초기화
            updateYearlyCrops();
            updateYearlyAnalysisTitle();
        });
    }
    
    // 작목상세 필터 업데이트
    updateYearlyCrops();
}

function updateYearlyCrops() {
    const { regions, datasets } = getComparisonModeInfo(yearlyFilters.comparisonMode);
    
    if (!yearlyFilters.cropGroup) return;
    
    // 모든 데이터셋에서 공통으로 있는 작목만 표시
    let commonCrops = [];
    
    if (datasets.length === 1) {
        // 단일 데이터셋인 경우
        const dataset = datasets[0];
        const data = dataset.isYearly ? csvData2 : csvData;
        commonCrops = [...new Set(data.filter(item => 
            item.region === dataset.region && item.cropGroup === yearlyFilters.cropGroup
        ).map(item => item.crop))].sort();
    } else {
        // 두 데이터셋 비교인 경우 교집합 찾기
        const sets = datasets.map(dataset => {
            const data = dataset.isYearly ? csvData2 : csvData;
            return new Set(data.filter(item => 
                item.region === dataset.region && item.cropGroup === yearlyFilters.cropGroup
            ).map(item => item.crop));
        });
        
        if (sets.length === 2) {
            commonCrops = [...sets[0]].filter(crop => sets[1].has(crop)).sort();
        }
    }
    
    const yearlyCropSelect = document.getElementById('yearlyCropSelect');
    if (yearlyCropSelect) {
        yearlyCropSelect.innerHTML = '';
        commonCrops.forEach((crop, index) => {
            const isSelected = yearlyFilters.crop === crop || (!yearlyFilters.crop && index === 0) ? 'selected' : '';
            yearlyCropSelect.innerHTML += `<option value="${crop}" ${isSelected}>${crop}</option>`;
            // 첫 번째 항목을 기본값으로 설정
            if (!yearlyFilters.crop && index === 0) {
                yearlyFilters.crop = crop;
            }
        });
        
        // 드롭다운 옵션 텍스트 업데이트 (초기 로드시)
        updateDropdownOptions();
        
        // 기존 이벤트 리스너 제거 후 새로 추가
        const newSelect = yearlyCropSelect.cloneNode(true);
        yearlyCropSelect.parentNode.replaceChild(newSelect, yearlyCropSelect);
        
        newSelect.addEventListener('change', function() {
            yearlyFilters.crop = this.value;
            updateDropdownOptions(); // 드롭다운 옵션 텍스트 업데이트
            updateYearlyAnalysisTitle();
        });
    }
}

// 최신 연도 가져오기 함수
function getLatestYear() {
    if (!csvData || csvData.length === 0) return '2023';
    
    const years = [...new Set(csvData.map(item => item.year))].filter(year => year && year.toString().length === 4);
    return years.sort((a, b) => b - a)[0] || '2023'; // 내림차순으로 정렬하여 최신 연도 반환
}

// 비교 모드 정보 파싱 함수
function getComparisonModeInfo(mode) {
    const latestYear = getLatestYear();
    
    const modes = {
        'gangwon-yearly-vs-current': {
            regions: ['강원', '강원'],
            datasets: [
                { region: '강원', isYearly: true },
                { region: '강원', isYearly: false }
            ],
            title: `강원 평년 vs 강원 ${latestYear}년`
        },
        'national-vs-gangwon-yearly': {
            regions: ['전국', '강원'],
            datasets: [
                { region: '전국', isYearly: true },
                { region: '강원', isYearly: true }
            ],
            title: '전국 평년 vs 강원 평년'
        },
        'national-yearly-vs-gangwon-current': {
            regions: ['전국', '강원'],
            datasets: [
                { region: '전국', isYearly: true },
                { region: '강원', isYearly: false }
            ],
            title: `전국 평년 vs 강원 ${latestYear}년`
        },
        'national-yearly-vs-current': {
            regions: ['전국', '전국'],
            datasets: [
                { region: '전국', isYearly: true },
                { region: '전국', isYearly: false }
            ],
            title: `전국 평년 vs 전국 ${latestYear}년`
        }
    };
    
    return modes[mode] || modes['gangwon-yearly-vs-current'];
}

// 분석표 타이틀 업데이트
function updateYearlyAnalysisTitle() {
    const titleElement = document.getElementById('yearlyAnalysisTitle');
    if (!titleElement) return;
    
    const { title } = getComparisonModeInfo(yearlyFilters.comparisonMode);
    let fullTitle = title;
    
    if (yearlyFilters.crop) {
        fullTitle += ` ${yearlyFilters.crop}`;
    }
    
    fullTitle += ' 분석';
    titleElement.innerHTML = fullTitle + '<button onclick="exportYearlyAnalysisToExcel()" class="excel-download-btn" title="엑셀 다운로드"></button>';
    
    // 분석표 데이터 업데이트
    updateYearlyAnalysisData();
    
    // 작목별 소득 테이블 업데이트
    updateYearlyCropIncomeTable();
}

// 평년탭 분석표 데이터 업데이트
function updateYearlyAnalysisData() {
    const { regions, datasets } = getComparisonModeInfo(yearlyFilters.comparisonMode);
    
    if (!yearlyFilters.cropGroup || !yearlyFilters.crop) {
        // 필터가 선택되지 않은 경우
        const tableBody = document.getElementById('yearlyAnalysisTableBody');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="5" class="loading">작목군과 작목을 선택해주세요.</td></tr>';
        }
        updateYearlySummaryBox(0, 0, 0, 0, '', '');
        return;
    }
    
    try {
        const analysisData = calculateYearlyAnalysis(regions, datasets);
        updateYearlyAnalysisTable(analysisData);
    } catch (error) {
        console.error('평년탭 분석 데이터 계산 오류:', error);
        const tableBody = document.getElementById('yearlyAnalysisTableBody');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="5" class="loading">데이터를 불러올 수 없습니다.</td></tr>';
        }
        updateYearlySummaryBox(0, 0, 0, 0, '', '');
    }
}

// 평년탭 분석 데이터 계산 - 비교모드에 따른 데이터 소스 매핑
function calculateYearlyAnalysis(regions, datasets) {
    const latestYear = getLatestYear();
    const comparisonMode = yearlyFilters.comparisonMode;
    
    let baseData = [];
    let compareData = [];
    let baseLabel = '';
    let compareLabel = '';
    
    // 비교 모드에 따른 데이터 소스 및 레이블 결정
    if (comparisonMode === 'gangwon-yearly-vs-current') {
        // 강원 평년 vs 강원 2023년
        baseData = csvData2.filter(item => 
            item.region === '강원' &&
            item.cropGroup === yearlyFilters.cropGroup &&
            item.crop === yearlyFilters.crop
        );
        compareData = csvData.filter(item => 
            item.region === '강원' &&
            item.year === latestYear &&
            item.cropGroup === yearlyFilters.cropGroup &&
            item.crop === yearlyFilters.crop
        );
        baseLabel = '강원평년';
        compareLabel = `강원${latestYear}년`;
        
    } else if (comparisonMode === 'national-vs-gangwon-yearly') {
        // 전국 평년 vs 강원 평년
        baseData = csvData2.filter(item => 
            item.region === '전국' &&
            item.cropGroup === yearlyFilters.cropGroup &&
            item.crop === yearlyFilters.crop
        );
        compareData = csvData2.filter(item => 
            item.region === '강원' &&
            item.cropGroup === yearlyFilters.cropGroup &&
            item.crop === yearlyFilters.crop
        );
        baseLabel = '전국평년';
        compareLabel = '강원평년';
        
    } else if (comparisonMode === 'national-yearly-vs-gangwon-current') {
        // 전국 평년 vs 강원 2023년
        baseData = csvData2.filter(item => 
            item.region === '전국' &&
            item.cropGroup === yearlyFilters.cropGroup &&
            item.crop === yearlyFilters.crop
        );
        compareData = csvData.filter(item => 
            item.region === '강원' &&
            item.year === latestYear &&
            item.cropGroup === yearlyFilters.cropGroup &&
            item.crop === yearlyFilters.crop
        );
        baseLabel = '전국평년';
        compareLabel = `강원${latestYear}년`;
        
    } else if (comparisonMode === 'national-yearly-vs-current') {
        // 전국 평년 vs 전국 2023년
        baseData = csvData2.filter(item => 
            item.region === '전국' &&
            item.cropGroup === yearlyFilters.cropGroup &&
            item.crop === yearlyFilters.crop
        );
        compareData = csvData.filter(item => 
            item.region === '전국' &&
            item.year === latestYear &&
            item.cropGroup === yearlyFilters.cropGroup &&
            item.crop === yearlyFilters.crop
        );
        baseLabel = '전국평년';
        compareLabel = `전국${latestYear}년`;
    }
    
    return {
        baseData: baseData,
        compareData: compareData,
        baseLabel: baseLabel,
        compareLabel: compareLabel
    };
}

// 평년탭 분석표 테이블 업데이트 - 동적 헤더 및 새로운 데이터 구조
function updateYearlyAnalysisTable(analysisData) {
    const tableHead = document.getElementById('yearlyAnalysisTableHead');
    const tableBody = document.getElementById('yearlyAnalysisTableBody');
    if (!tableHead || !tableBody) return;
    
    // 테이블 헤더 동적 생성
    tableHead.innerHTML = `
        <tr>
            <th>구분</th>
            <th>${analysisData.baseLabel}</th>
            <th>${analysisData.compareLabel}</th>
            <th>차이</th>
            <th>대비(%)</th>
        </tr>
    `;
    
    if (!analysisData.baseData || !analysisData.compareData) {
        tableBody.innerHTML = '<tr><td colspan="5" class="loading">선택한 조건의 데이터가 없습니다.</td></tr>';
        return;
    }
    
    // 기준 데이터와 비교 데이터를 맵으로 변환
    const baseItemMap = {};
    const compareItemMap = {};
    
    analysisData.baseData.forEach(item => {
        const value = typeof item.value === 'string' ? 
            parseFloat(item.value.toString().replace(/,/g, '')) : 
            parseFloat(item.value);
        baseItemMap[item.category] = isNaN(value) ? 0 : value;
    });
    
    analysisData.compareData.forEach(item => {
        const value = typeof item.value === 'string' ? 
            parseFloat(item.value.toString().replace(/,/g, '')) : 
            parseFloat(item.value);
        compareItemMap[item.category] = isNaN(value) ? 0 : value;
    });
    
    let html = '';
    let totalBase = 0;
    let totalCompare = 0;
    
    // 총수입 박스
    const baseTotalRevenue = baseItemMap['총수입'] || 0;
    const compareTotalRevenue = compareItemMap['총수입'] || 0;
    const revenueDiff = compareTotalRevenue - baseTotalRevenue;
    const revenueChangeRate = baseTotalRevenue > 0 ? ((revenueDiff / baseTotalRevenue) * 100) : 0;
    
    totalBase = baseItemMap['소득'] || 0;
    totalCompare = compareItemMap['소득'] || 0;
    
    const revenueDiffColor = compareTotalRevenue > baseTotalRevenue ? 'color: #dc2626;' : 'color: #1e40af;';
    const revenueRatioColor = revenueChangeRate > 0 ? 'color: #dc2626;' : revenueChangeRate < 0 ? 'color: #1e40af;' : 'color: #64748b;';
    
    const baseTotalRevenueDisplay = (baseTotalRevenue === 0) ? '-' : baseTotalRevenue.toLocaleString();
    const compareTotalRevenueDisplay = (compareTotalRevenue === 0) ? '-' : compareTotalRevenue.toLocaleString();
    const revenueDiffDisplay = (baseTotalRevenue === 0 && compareTotalRevenue === 0) ? '-' : Math.abs(revenueDiff).toLocaleString();
    const revenueRatioDisplay = (baseTotalRevenue === 0 && compareTotalRevenue === 0) ? '-' : 
        revenueChangeRate === 0 ? '0.0%' :
        revenueChangeRate > 0 ? `▲ +${revenueChangeRate.toFixed(1)}%` : 
        revenueChangeRate < 0 ? `▼ ${revenueChangeRate.toFixed(1)}%` : `0.0%`;
    
    html += `
        <tr>
            <td style="background-color: #f8fafc; font-weight: bold;">총수입</td>
            <td style="background-color: #f8fafc; font-weight: bold;">${baseTotalRevenueDisplay}</td>
            <td style="background-color: #f8fafc; font-weight: bold;">${compareTotalRevenueDisplay}</td>
            <td style="background-color: #f8fafc; font-weight: bold; ${revenueDiffColor}">${revenueDiffDisplay}</td>
            <td style="background-color: #f8fafc; font-weight: bold; ${revenueRatioColor}">${revenueRatioDisplay}</td>
        </tr>
    `;
    
    // 수입 항목들
    const revenueItems = ['주산물가액', '주산물수량', '부산물가액', '수취가격'];
    revenueItems.forEach(itemName => {
        const baseValue = baseItemMap[itemName] || 0;
        const compareValue = compareItemMap[itemName] || 0;
        const difference = compareValue - baseValue;
        const changeRate = baseValue > 0 ? ((difference / baseValue) * 100) : 0;
        
        const baseDisplay = (baseValue === 0) ? '-' : baseValue.toLocaleString();
        const compareDisplay = (compareValue === 0) ? '-' : compareValue.toLocaleString();
        const differenceDisplay = (baseValue === 0 && compareValue === 0) ? '-' : Math.abs(difference).toLocaleString();
        const ratioDisplay = (baseValue === 0 && compareValue === 0) ? '-' : 
            changeRate === 0 ? '0.0%' :
            changeRate > 0 ? `▲ +${changeRate.toFixed(1)}%` : 
            changeRate < 0 ? `▼ ${changeRate.toFixed(1)}%` : `0.0%`;
            
        const diffColor = compareValue > baseValue ? 'color: #dc2626;' : 'color: #1e40af;';
        const ratioColor = changeRate > 0 ? 'color: #dc2626;' : changeRate < 0 ? 'color: #1e40af;' : 'color: #64748b;';
        
        html += `
            <tr>
                <td>${itemName}</td>
                <td>${baseDisplay}</td>
                <td>${compareDisplay}</td>
                <td style="${diffColor}">${differenceDisplay}</td>
                <td style="${ratioColor}">${ratioDisplay}</td>
            </tr>
        `;
    });
    
    // 중간재비 계산
    let baseTotalMaterial = 0;
    let compareTotalMaterial = 0;
    
    const materialCostItems = yearlyFilters.cropGroup === '과수' ? 
        ['과수원조성비', '보통(무기질)비료비', '부산물(유기질)비료비', '농약비', '수도광열비', '기타재료비', '소농구비', '대농구상각비', '영농시설상각비', '수리·유지비', '기타비용'] :
        ['종자·종묘비', '보통(무기질)비료비', '부산물(유기질)비료비', '농약비', '수도광열비', '기타재료비', '소농구비', '대농구상각비', '영농시설상각비', '수리·유지비', '기타비용'];
    
    materialCostItems.forEach(itemName => {
        const baseValue = baseItemMap[itemName] || 0;
        const compareValue = compareItemMap[itemName] || 0;
        baseTotalMaterial += baseValue;
        compareTotalMaterial += compareValue;
    });
    
    const materialDiff = compareTotalMaterial - baseTotalMaterial;
    const materialChangeRate = baseTotalMaterial > 0 ? ((materialDiff / baseTotalMaterial) * 100) : 0;
    
    const materialDiffColor = compareTotalMaterial > baseTotalMaterial ? 'color: #dc2626;' : 'color: #1e40af;';
    const materialRatioColor = materialChangeRate > 0 ? 'color: #dc2626;' : materialChangeRate < 0 ? 'color: #1e40af;' : 'color: #64748b;';
    
    const baseTotalMaterialDisplay = (baseTotalMaterial === 0) ? '-' : baseTotalMaterial.toLocaleString();
    const compareTotalMaterialDisplay = (compareTotalMaterial === 0) ? '-' : compareTotalMaterial.toLocaleString();
    const materialDiffDisplay = (baseTotalMaterial === 0 && compareTotalMaterial === 0) ? '-' : Math.abs(materialDiff).toLocaleString();
    const materialRatioDisplay = (baseTotalMaterial === 0 && compareTotalMaterial === 0) ? '-' :
        materialChangeRate === 0 ? '0.0%' : 
        materialChangeRate > 0 ? `▲ +${materialChangeRate.toFixed(1)}%` : 
        materialChangeRate < 0 ? `▼ ${materialChangeRate.toFixed(1)}%` : `0.0%`;
    
    html += `
        <tr>
            <td style="background-color: #f8fafc; font-weight: bold;">중간재비</td>
            <td style="background-color: #f8fafc; font-weight: bold;">${baseTotalMaterialDisplay}</td>
            <td style="background-color: #f8fafc; font-weight: bold;">${compareTotalMaterialDisplay}</td>
            <td style="background-color: #f8fafc; font-weight: bold; ${materialDiffColor}">${materialDiffDisplay}</td>
            <td style="background-color: #f8fafc; font-weight: bold; ${materialRatioColor}">${materialRatioDisplay}</td>
        </tr>
    `;
    
    // 중간재비 세부 항목들
    materialCostItems.forEach(itemName => {
        const baseValue = baseItemMap[itemName] || 0;
        const compareValue = compareItemMap[itemName] || 0;
        const difference = compareValue - baseValue;
        const changeRate = baseValue > 0 ? ((difference / baseValue) * 100) : 0;
        
        const baseDisplay = (baseValue === 0) ? '-' : baseValue.toLocaleString();
        const compareDisplay = (compareValue === 0) ? '-' : compareValue.toLocaleString();
        const differenceDisplay = (baseValue === 0 && compareValue === 0) ? '-' : Math.abs(difference).toLocaleString();
        const ratioDisplay = (baseValue === 0 && compareValue === 0) ? '-' : 
            changeRate === 0 ? '0.0%' :
            changeRate > 0 ? `▲ +${changeRate.toFixed(1)}%` : 
            changeRate < 0 ? `▼ ${changeRate.toFixed(1)}%` : `0.0%`;
            
        const diffColor = compareValue > baseValue ? 'color: #dc2626;' : 'color: #1e40af;';
        const ratioColor = changeRate > 0 ? 'color: #dc2626;' : changeRate < 0 ? 'color: #1e40af;' : 'color: #64748b;';
        
        html += `
            <tr>
                <td style="padding-left: 20px;">${itemName}</td>
                <td>${baseDisplay}</td>
                <td>${compareDisplay}</td>
                <td style="${diffColor}">${differenceDisplay}</td>
                <td style="${ratioColor}">${ratioDisplay}</td>
            </tr>
        `;
    });
    
    // 경영비 총합 표시
    const baseManagementCost = baseItemMap['경영비'] || 0;
    const compareManagementCost = compareItemMap['경영비'] || 0;
    const managementDiff = compareManagementCost - baseManagementCost;
    const managementChangeRate = baseManagementCost > 0 ? ((managementDiff / baseManagementCost) * 100) : 0;
    
    const managementDiffColor = compareManagementCost > baseManagementCost ? 'color: #dc2626;' : 'color: #1e40af;';
    const managementRatioColor = managementChangeRate > 0 ? 'color: #dc2626;' : managementChangeRate < 0 ? 'color: #1e40af;' : 'color: #64748b;';
    
    const baseManagementCostDisplay = baseManagementCost.toLocaleString();
    const compareManagementCostDisplay = compareManagementCost.toLocaleString();
    const managementDiffDisplay = Math.abs(managementDiff).toLocaleString();
    const managementRatioDisplay = managementChangeRate === 0 ? '0.0%' : 
        managementChangeRate > 0 ? `▲ +${managementChangeRate.toFixed(1)}%` : 
        managementChangeRate < 0 ? `▼ ${managementChangeRate.toFixed(1)}%` : `0.0%`;
    
    html += `
        <tr>
            <td style="background-color: #f8fafc; font-weight: bold;">경영비</td>
            <td style="background-color: #f8fafc; font-weight: bold;">${baseManagementCostDisplay}</td>
            <td style="background-color: #f8fafc; font-weight: bold;">${compareManagementCostDisplay}</td>
            <td style="background-color: #f8fafc; font-weight: bold; ${managementDiffColor}">${managementDiffDisplay}</td>
            <td style="background-color: #f8fafc; font-weight: bold; ${managementRatioColor}">${managementRatioDisplay}</td>
        </tr>
    `;
    
    // 경영비 세부 항목들
    const costItems = ['농기계·시설임차료', '토지임차료', '위탁영농비', '고용노동비'];
    costItems.forEach(itemName => {
        const baseValue = baseItemMap[itemName] || 0;
        const compareValue = compareItemMap[itemName] || 0;
        const difference = compareValue - baseValue;
        const changeRate = baseValue > 0 ? ((difference / baseValue) * 100) : 0;
        
        const baseDisplay = (baseValue === 0) ? '-' : baseValue.toLocaleString();
        const compareDisplay = (compareValue === 0) ? '-' : compareValue.toLocaleString();
        const differenceDisplay = (baseValue === 0 && compareValue === 0) ? '-' : Math.abs(difference).toLocaleString();
        const ratioDisplay = (baseValue === 0 && compareValue === 0) ? '-' : 
            changeRate === 0 ? '0.0%' :
            changeRate > 0 ? `▲ +${changeRate.toFixed(1)}%` : 
            changeRate < 0 ? `▼ ${changeRate.toFixed(1)}%` : `0.0%`;
            
        const diffColor = compareValue > baseValue ? 'color: #dc2626;' : 'color: #1e40af;';
        const ratioColor = changeRate > 0 ? 'color: #dc2626;' : changeRate < 0 ? 'color: #1e40af;' : 'color: #64748b;';
        
        html += `
            <tr>
                <td>${itemName}</td>
                <td>${baseDisplay}</td>
                <td>${compareDisplay}</td>
                <td style="${diffColor}">${differenceDisplay}</td>
                <td style="${ratioColor}">${ratioDisplay}</td>
            </tr>
        `;
    });
    
    // 생산비 총합 표시
    const baseProductionCost = baseItemMap['생산비'] || 0;
    const compareProductionCost = compareItemMap['생산비'] || 0;
    const productionDiff = compareProductionCost - baseProductionCost;
    const productionChangeRate = baseProductionCost > 0 ? ((productionDiff / baseProductionCost) * 100) : 0;
    
    const productionDiffColor = compareProductionCost > baseProductionCost ? 'color: #dc2626;' : 'color: #1e40af;';
    const productionRatioColor = productionChangeRate > 0 ? 'color: #dc2626;' : productionChangeRate < 0 ? 'color: #1e40af;' : 'color: #64748b;';
    
    const baseProductionCostDisplay = baseProductionCost.toLocaleString();
    const compareProductionCostDisplay = compareProductionCost.toLocaleString();
    const productionDiffDisplay = Math.abs(productionDiff).toLocaleString();
    const productionRatioDisplay = productionChangeRate === 0 ? '0.0%' : 
        productionChangeRate > 0 ? `▲ +${productionChangeRate.toFixed(1)}%` : 
        productionChangeRate < 0 ? `▼ ${productionChangeRate.toFixed(1)}%` : `0.0%`;
    
    html += `
        <tr>
            <td style="background-color: #f8fafc; font-weight: bold;">생산비</td>
            <td style="background-color: #f8fafc; font-weight: bold;">${baseProductionCostDisplay}</td>
            <td style="background-color: #f8fafc; font-weight: bold;">${compareProductionCostDisplay}</td>
            <td style="background-color: #f8fafc; font-weight: bold; ${productionDiffColor}">${productionDiffDisplay}</td>
            <td style="background-color: #f8fafc; font-weight: bold; ${productionRatioColor}">${productionRatioDisplay}</td>
        </tr>
    `;
    
    // 생산비 세부 항목들
    const productionItems = ['자가노동비', '유동자본용역비', '고정자본용역비', '토지자본용역비'];
    productionItems.forEach(itemName => {
        const baseValue = baseItemMap[itemName] || 0;
        const compareValue = compareItemMap[itemName] || 0;
        const difference = compareValue - baseValue;
        const changeRate = baseValue > 0 ? ((difference / baseValue) * 100) : 0;
        
        const baseDisplay = (baseValue === 0 && !baseItemMap.hasOwnProperty(itemName)) ? '-' : baseValue.toLocaleString();
        const compareDisplay = (compareValue === 0 && !compareItemMap.hasOwnProperty(itemName)) ? '-' : compareValue.toLocaleString();
        const differenceDisplay = (Math.abs(difference) === 0 && nationalValue === 0 && gangwonValue === 0) ? '-' : Math.abs(difference).toLocaleString();
        const ratioDisplay = changeRate === 0 ? '0.0%' : 
            changeRate > 0 ? `▲ +${changeRate.toFixed(1)}%` : 
            changeRate < 0 ? `▼ ${changeRate.toFixed(1)}%` : `0.0%`;
            
        const diffColor = compareValue > baseValue ? 'color: #dc2626;' : 'color: #1e40af;';
        const ratioColor = changeRate > 0 ? 'color: #dc2626;' : changeRate < 0 ? 'color: #1e40af;' : 'color: #64748b;';
        
        // 노지풋옥수수일 때 kg당 -> 개당으로 표시  
        let displayName = itemName;
        if (yearlyFilters.crop === '노지풋옥수수') {
            displayName = itemName.replace('kg당', '개당');
        }
        
        html += `
            <tr>
                <td>${displayName}</td>
                <td>${baseDisplay}</td>
                <td>${compareDisplay}</td>
                <td style="${diffColor}">${differenceDisplay}</td>
                <td style="${ratioColor}">${ratioDisplay}</td>
            </tr>
        `;
    });
    
    // 최종 항목들 - 지정된 순서대로
    const finalItems = ['소득', '소득률', '부가가치', '부가가치율', '노동생산성', '자본생산성', '토지생산성', 'kg당 생산비', 'kg당 경영비'];
    finalItems.forEach(itemName => {
        const baseValue = baseItemMap[itemName] || 0;
        const compareValue = compareItemMap[itemName] || 0;
        const difference = compareValue - baseValue;
        const changeRate = baseValue > 0 ? ((difference / baseValue) * 100) : 0;
        
        const baseDisplay = (baseValue === 0 && !baseItemMap.hasOwnProperty(itemName)) ? '-' : baseValue.toLocaleString();
        const compareDisplay = (compareValue === 0 && !compareItemMap.hasOwnProperty(itemName)) ? '-' : compareValue.toLocaleString();
        const differenceDisplay = (Math.abs(difference) === 0 && nationalValue === 0 && gangwonValue === 0) ? '-' : Math.abs(difference).toLocaleString();
        const ratioDisplay = changeRate === 0 ? '0.0%' : 
            changeRate > 0 ? `▲ +${changeRate.toFixed(1)}%` : 
            changeRate < 0 ? `▼ ${changeRate.toFixed(1)}%` : `0.0%`;
            
        const diffColor = compareValue > baseValue ? 'color: #dc2626;' : 'color: #1e40af;';
        const ratioColor = changeRate > 0 ? 'color: #dc2626;' : changeRate < 0 ? 'color: #1e40af;' : 'color: #64748b;';
        
        // 노지풋옥수수일 때 kg당 -> 개당으로 표시
        let displayName = itemName;
        if (yearlyFilters.crop === '노지풋옥수수') {
            displayName = itemName.replace('kg당', '개당');
        }
        
        html += `
            <tr>
                <td style="background-color: #f8fafc; font-weight: bold;">${displayName}</td>
                <td style="background-color: #f8fafc; font-weight: bold;">${baseDisplay}</td>
                <td style="background-color: #f8fafc; font-weight: bold;">${compareDisplay}</td>
                <td style="background-color: #f8fafc; font-weight: bold; ${diffColor}">${differenceDisplay}</td>
                <td style="background-color: #f8fafc; font-weight: bold; ${ratioColor}">${ratioDisplay}</td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
    
    // 요약 박스 업데이트
    const difference = totalCompare - totalBase;
    const ratio = totalBase > 0 ? ((difference / totalBase) * 100) : 0;
    updateYearlySummaryBox(totalBase, totalCompare, difference, ratio, analysisData.baseLabel, analysisData.compareLabel);
}

// 평년탭 작목별 소득 테이블 업데이트
function updateYearlyCropIncomeTable() {
    const tableBody = document.getElementById('yearlyCropIncomeTableBody');
    const titleElement = document.getElementById('yearlyCropIncomeTitle');
    const baseHeaderElement = document.getElementById('yearlyIncomeBaseHeader');
    const compareHeaderElement = document.getElementById('yearlyIncomeCompareHeader');
    const cropGroupFilter = document.getElementById('yearlyCropGroupFilter');
    
    if (!tableBody) return;
    
    // income-table은 독립적인 필터를 사용하므로 yearlyFilters.cropGroup 체크 제거
    // if (!yearlyFilters.cropGroup) {
    //     tableBody.innerHTML = '<tr><td colspan="5" class="loading">작목군을 선택해주세요.</td></tr>';
    //     return;
    // }
    
    const latestYear = getLatestYear();
    const comparisonMode = yearlyFilters.comparisonMode;
    const selectedCropGroup = cropGroupFilter ? cropGroupFilter.value : 'all';
    
    
    // 비교 모드에 따른 데이터 소스와 레이블 결정
    let baseData = [];
    let compareData = [];
    let baseLabel = '';
    let compareLabel = '';
    
    if (comparisonMode === 'gangwon-yearly-vs-current') {
        const baseFilter = selectedCropGroup === 'all' ? 
            {region: '강원', category: '소득'} : 
            {region: '강원', cropGroup: selectedCropGroup, category: '소득'};
        const compareFilter = selectedCropGroup === 'all' ? 
            {region: '강원', year: latestYear, category: '소득'} : 
            {region: '강원', year: latestYear, cropGroup: selectedCropGroup, category: '소득'};
        
        baseData = csvData2.filter(item => 
            Object.keys(baseFilter).every(key => item[key] === baseFilter[key])
        );
        compareData = csvData.filter(item => 
            Object.keys(compareFilter).every(key => item[key] === compareFilter[key])
        );
        baseLabel = '강원 평년';
        compareLabel = `강원 ${latestYear}년`;
        
    } else if (comparisonMode === 'national-vs-gangwon-yearly') {
        const baseFilter = selectedCropGroup === 'all' ? 
            {region: '전국', category: '소득'} : 
            {region: '전국', cropGroup: selectedCropGroup, category: '소득'};
        const compareFilter = selectedCropGroup === 'all' ? 
            {region: '강원', category: '소득'} : 
            {region: '강원', cropGroup: selectedCropGroup, category: '소득'};
        
        baseData = csvData2.filter(item => 
            Object.keys(baseFilter).every(key => item[key] === baseFilter[key])
        );
        compareData = csvData2.filter(item => 
            Object.keys(compareFilter).every(key => item[key] === compareFilter[key])
        );
        baseLabel = '전국 평년';
        compareLabel = '강원 평년';
        
    } else if (comparisonMode === 'national-yearly-vs-gangwon-current') {
        const baseFilter = selectedCropGroup === 'all' ? 
            {region: '전국', category: '소득'} : 
            {region: '전국', cropGroup: selectedCropGroup, category: '소득'};
        const compareFilter = selectedCropGroup === 'all' ? 
            {region: '강원', year: latestYear, category: '소득'} : 
            {region: '강원', year: latestYear, cropGroup: selectedCropGroup, category: '소득'};
        
        baseData = csvData2.filter(item => 
            Object.keys(baseFilter).every(key => item[key] === baseFilter[key])
        );
        compareData = csvData.filter(item => 
            Object.keys(compareFilter).every(key => item[key] === compareFilter[key])
        );
        baseLabel = '전국 평년';
        compareLabel = `강원 ${latestYear}년`;
        
    } else if (comparisonMode === 'national-yearly-vs-current') {
        const baseFilter = selectedCropGroup === 'all' ? 
            {region: '전국', category: '소득'} : 
            {region: '전국', cropGroup: selectedCropGroup, category: '소득'};
        const compareFilter = selectedCropGroup === 'all' ? 
            {region: '전국', year: latestYear, category: '소득'} : 
            {region: '전국', year: latestYear, cropGroup: selectedCropGroup, category: '소득'};
        
        baseData = csvData2.filter(item => 
            Object.keys(baseFilter).every(key => item[key] === baseFilter[key])
        );
        compareData = csvData.filter(item => 
            Object.keys(compareFilter).every(key => item[key] === compareFilter[key])
        );
        baseLabel = '전국 평년';
        compareLabel = `전국 ${latestYear}년`;
    }
    
    if (titleElement) {
        const cropGroupText = selectedCropGroup === 'all' ? '전체' : selectedCropGroup;
        titleElement.innerHTML = `${baseLabel} vs ${compareLabel} ${cropGroupText} 작목별 소득<button onclick="exportYearlyIncomeTableToExcel()" class="excel-download-btn" title="엑셀 다운로드"></button>`;
    }
    
    if (baseHeaderElement) {
        // 2줄 헤더 구조 유지하면서 텍스트 변경
        const headerContent = baseHeaderElement.querySelector('.header-content');
        if (headerContent) {
            const headerMain = headerContent.querySelector('.header-main');
            if (headerMain) {
                const sortArrow = headerMain.querySelector('.sort-arrow');
                headerMain.textContent = baseLabel;
                if (sortArrow) {
                    headerMain.appendChild(sortArrow);
                } else {
                    const newSortArrow = document.createElement('span');
                    newSortArrow.className = 'sort-arrow';
                    headerMain.appendChild(newSortArrow);
                }
            }
        } else {
            // 구조가 없으면 새로 생성
            baseHeaderElement.innerHTML = `
                <div class="header-content">
                    <div class="header-main">${baseLabel}<span class="sort-arrow"></span></div>
                    <div class="header-unit">(원/10a)</div>
                </div>
            `;
        }
    }
    
    if (compareHeaderElement) {
        // 2줄 헤더 구조 유지하면서 텍스트 변경
        const headerContent = compareHeaderElement.querySelector('.header-content');
        if (headerContent) {
            const headerMain = headerContent.querySelector('.header-main');
            if (headerMain) {
                const sortArrow = headerMain.querySelector('.sort-arrow');
                headerMain.textContent = compareLabel;
                if (sortArrow) {
                    headerMain.appendChild(sortArrow);
                } else {
                    const newSortArrow = document.createElement('span');
                    newSortArrow.className = 'sort-arrow';
                    headerMain.appendChild(newSortArrow);
                }
            }
        } else {
            // 구조가 없으면 새로 생성
            compareHeaderElement.innerHTML = `
                <div class="header-content">
                    <div class="header-main">${compareLabel}<span class="sort-arrow"></span></div>
                    <div class="header-unit">(원/10a)</div>
                </div>
            `;
        }
    }
    
    // 데이터 매핑
    const baseItemMap = {};
    const compareItemMap = {};
    
    baseData.forEach(item => {
        baseItemMap[item.crop] = item.value || 0;
    });
    
    compareData.forEach(item => {
        compareItemMap[item.crop] = item.value || 0;
    });
    
    // 기준값과 비교값이 모두 있는 작목만 필터링하고 데이터 구조화
    const tableData = [];
    const allCrops = [...new Set([...Object.keys(baseItemMap), ...Object.keys(compareItemMap)])]
        .filter(crop => baseItemMap[crop] > 0 && compareItemMap[crop] > 0);
    
    allCrops.forEach(crop => {
        const baseValue = baseItemMap[crop];
        const compareValue = compareItemMap[crop];
        const difference = compareValue - baseValue;
        const ratio = baseValue > 0 ? ((compareValue / baseValue) * 100) : 0;
        
        tableData.push({
            crop: crop,
            baseValue: baseValue,
            compareValue: compareValue,
            difference: difference,
            ratio: ratio
        });
    });
    
    if (tableData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="loading">해당 조건의 소득 데이터가 없습니다.</td></tr>';
        return;
    }
    
    // 원본 데이터 저장 (정렬용)
    yearlyOriginalTableData = [...tableData];
    
    // 정렬 이벤트 리스너 초기화
    setTimeout(() => {
        initializeYearlyTableSorting();
    }, 100);
    
    // 기존 정렬 상태가 있으면 적용, 없으면 기본 정렬 (작목명 오름차순)
    if (yearlyCurrentSort.column) {
        sortYearlyTableByColumn(yearlyCurrentSort.column);
    } else {
        tableData.sort((a, b) => a.crop.localeCompare(b.crop));
        renderYearlyTableWithData(tableData);
    }
}

// 평년탭 요약 박스 업데이트
function updateYearlySummaryBox(baseValue, compareValue, difference, ratio, baseLabel, compareLabel) {
    const baseIncomeElement = document.getElementById('yearlyBaseIncome');
    const compareIncomeElement = document.getElementById('yearlyCompareIncome');
    const differenceElement = document.getElementById('yearlyDifference');
    const ratioElement = document.getElementById('yearlyRatio');
    const baseLabelElement = document.getElementById('yearlyBaseLabel');
    const compareLabelElement = document.getElementById('yearlyCompareLabel');
    
    if (baseIncomeElement) {
        baseIncomeElement.textContent = `${baseValue.toLocaleString()}원`;
    }
    
    if (compareIncomeElement) {
        compareIncomeElement.textContent = `${compareValue.toLocaleString()}원`;
    }
    
    if (differenceElement) {
        const prefix = difference >= 0 ? '+' : '';
        differenceElement.textContent = `${prefix}${Math.abs(difference).toLocaleString()}원`;
        // 비교값이 기준값보다 크면 빨간색, 작으면 파란색
        differenceElement.style.color = compareValue > baseValue ? '#dc2626' : '#1e40af';
    }
    
    if (ratioElement) {
        const prefix = ratio >= 0 ? '+' : '';
        ratioElement.textContent = `${prefix}${ratio.toFixed(1)}%`;
        // 대비값이 양수(비교값이 더 큰 경우)면 빨간색, 음수면 파란색
        ratioElement.style.color = ratio > 0 ? '#dc2626' : ratio < 0 ? '#1e40af' : '#64748b';
    }
    
    if (baseLabelElement && baseLabel) {
        baseLabelElement.textContent = baseLabel;
    }
    
    if (compareLabelElement && compareLabel) {
        compareLabelElement.textContent = compareLabel;
    }
}

function updateSummaryRegionFilter(region) {
    summaryFilters.region = region;
    
    // UI 업데이트
    document.querySelectorAll('#summaryRegionFilter .summary-filter-btn').forEach(button => {
        button.classList.toggle('active', button.getAttribute('data-region') === region);
    });
    
    updateSummaryDisplay();
}

function updateSummaryYearFilter(year) {
    summaryFilters.year = year;
    
    // UI 업데이트
    document.querySelectorAll('#summaryYearFilter .summary-filter-btn').forEach(button => {
        button.classList.toggle('active', button.textContent === year);
    });
    
    updateSummaryDisplay();
}

function updateSummaryDisplay() {
    updateTop5Lists();
    updateSummaryDataTable();
}

// ========== 새로운 요약탭 함수들 ==========

function updateTop5Lists() {
    const region = summaryFilters.region;
    const year = summaryFilters.year;
    
    // 현재 필터에 맞는 데이터 수집
    const filteredData = csvData.filter(item => 
        item.region === region && 
        item.year === year && 
        item.crop && item.crop !== '전체'
    );
    
    // 각 카테고리별 TOP 5 업데이트
    updateTop5List('incomeTop5List', filteredData, '소득', '원');
    updateTop5List('laborTop5List', filteredData, '노동생산성', '');
    updateTop5List('capitalTop5List', filteredData, '자본생산성', '');
    updateKgProductionCostTop5List('landTop5List', filteredData);
}

function updateKgProductionCostTop5List(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // DB에서 kg당 생산비 데이터를 직접 가져와서 정렬 (낮은 순서대로)
    const kgCostList = data
        .filter(item => item.category === 'kg당 생산비' && item.value > 0)
        .map(item => ({
            crop: item.crop,
            cropGroup: item.cropGroup,
            kgCost: Math.round(item.value)
        }))
        .sort((a, b) => a.kgCost - b.kgCost) // 낮은 비용이 좋으므로 오름차순
        .slice(0, 5);
    
    if (kgCostList.length === 0) {
        container.innerHTML = '<div class="loading-item">데이터가 없습니다</div>';
        return;
    }
    
    const html = kgCostList.map((item, index) => `
        <div class="top5-item">
            <div class="rank-number">${index + 1}</div>
            <div class="crop-info">
                <div class="crop-name">${item.crop}</div>
                <div class="crop-group">${item.cropGroup}</div>
            </div>
            <div class="crop-value">${item.kgCost.toLocaleString()}</div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

function updateTop5List(containerId, data, category, unit) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // 해당 카테고리의 데이터 필터링 및 정렬
    const categoryData = data.filter(item => item.category === category);
    const sortedData = categoryData.sort((a, b) => b.value - a.value).slice(0, 5);
    
    if (sortedData.length === 0) {
        container.innerHTML = '<div class="loading-item">데이터가 없습니다</div>';
        return;
    }
    
    // TOP 5 리스트 HTML 생성
    const html = sortedData.map((item, index) => `
        <div class="top5-item">
            <div class="rank-number">${index + 1}</div>
            <div class="crop-info">
                <div class="crop-name">${item.crop}</div>
                <div class="crop-group">${item.cropGroup}</div>
            </div>
            <div class="crop-value">${item.value.toLocaleString()}${unit}</div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

// 평년탭 정렬 상태 관리
let yearlyCurrentSort = { column: null, direction: 'desc' };
let yearlyOriginalTableData = [];

// 비교탭 정렬 상태 관리
let compareCurrentSort = { column: null, direction: 'desc' };
let compareOriginalTableData = [];

// 평년탭 테이블 정렬 함수
function sortYearlyTableByColumn(column) {
    console.log('sortYearlyTableByColumn 호출:', column);
    console.log('yearlyOriginalTableData 길이:', yearlyOriginalTableData.length);
    
    if (!yearlyOriginalTableData.length) {
        console.log('원본 데이터가 없습니다');
        return;
    }
    
    // 같은 컬럼을 클릭하면 방향 토글, 다른 컬럼이면 내림차순으로 시작
    if (yearlyCurrentSort.column === column) {
        yearlyCurrentSort.direction = yearlyCurrentSort.direction === 'desc' ? 'asc' : 'desc';
    } else {
        yearlyCurrentSort.column = column;
        yearlyCurrentSort.direction = 'desc';
    }
    
    console.log('정렬 방향:', yearlyCurrentSort.direction);
    
    // 헤더 스타일 업데이트
    updateYearlySortHeaders();
    
    // 데이터 정렬
    const sortedData = [...yearlyOriginalTableData].sort((a, b) => {
        let aVal, bVal;
        
        switch(column) {
            case 'crop':
                aVal = a.crop;
                bVal = b.crop;
                return yearlyCurrentSort.direction === 'asc' ? 
                    aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            case 'baseValue':
                aVal = a.baseValue;
                bVal = b.baseValue;
                return yearlyCurrentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
            case 'compareValue':
                aVal = a.compareValue;
                bVal = b.compareValue;
                return yearlyCurrentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
            case 'difference':
                aVal = a.difference;
                bVal = b.difference;
                return yearlyCurrentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
            case 'ratio':
                aVal = a.baseValue > 0 ? ((a.difference / a.baseValue) * 100) : 0;
                bVal = b.baseValue > 0 ? ((b.difference / b.baseValue) * 100) : 0;
                return yearlyCurrentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
            default:
                return 0;
        }
    });
    
    // 테이블 다시 렌더링
    renderYearlyTableWithData(sortedData);
}

// 평년탭 정렬 헤더 업데이트
function updateYearlySortHeaders() {
    const tableContainer = document.querySelector('#yearly .income-table .table-container');
    if (!tableContainer) return;
    
    const headers = tableContainer.querySelectorAll('th.sortable');
    headers.forEach(header => {
        const column = header.getAttribute('data-sort');
        const arrow = header.querySelector('.sort-arrow');
        
        if (!arrow) {
            console.log('sort-arrow 요소를 찾을 수 없습니다:', header);
            return;
        }
        
        if (column === yearlyCurrentSort.column) {
            arrow.textContent = yearlyCurrentSort.direction === 'asc' ? ' ▲' : ' ▼';
            header.classList.add('active');
        } else {
            arrow.textContent = '';
            header.classList.remove('active');
        }
    });
}

// 평년탭 테이블 렌더링
function renderYearlyTableWithData(tableData) {
    const tableBody = document.getElementById('yearlyCropIncomeTableBody');
    if (!tableBody) return;
    
    let html = '';
    
    tableData.forEach(item => {
        const changeRate = item.baseValue > 0 ? ((item.difference / item.baseValue) * 100) : 0;
        
        const baseDisplay = `${item.baseValue.toLocaleString()}`;
        const compareDisplay = `${item.compareValue.toLocaleString()}`;
        const differenceDisplay = `${Math.abs(item.difference).toLocaleString()}`;
        const ratioDisplay = changeRate > 0 ? `▲ +${changeRate.toFixed(1)}%` : 
            changeRate < 0 ? `▼ ${changeRate.toFixed(1)}%` : `${item.ratio.toFixed(1)}%`;
        
        const diffColor = item.compareValue > item.baseValue ? 'color: #dc2626;' : 'color: #1e40af;';
        const ratioColor = changeRate > 0 ? 'color: #dc2626;' : changeRate < 0 ? 'color: #1e40af;' : 'color: #64748b;';
        
        html += `
            <tr data-crop="${item.crop}" data-base-value="${item.baseValue}" data-compare-value="${item.compareValue}" data-difference="${item.difference}" data-ratio="${changeRate}">
                <td>${item.crop}</td>
                <td>${baseDisplay}</td>
                <td>${compareDisplay}</td>
                <td style="${diffColor}">${differenceDisplay}</td>
                <td style="${ratioColor}">${ratioDisplay}</td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
}

// 평년탭 정렬 이벤트 리스너 초기화
function initializeYearlyTableSorting() {
    console.log('initializeYearlyTableSorting 시작');
    
    // 평년탭 테이블의 정렬 가능한 헤더들 찾기
    const tableContainer = document.querySelector('#yearly .income-table .table-container');
    if (!tableContainer) {
        console.log('평년탭 테이블 컨테이너를 찾을 수 없습니다');
        return;
    }
    
    const sortableHeaders = tableContainer.querySelectorAll('th.sortable');
    console.log('찾은 정렬 가능한 헤더 수:', sortableHeaders.length);
    
    if (sortableHeaders.length === 0) {
        console.log('정렬 가능한 헤더를 찾을 수 없습니다');
        return;
    }
    
    sortableHeaders.forEach((header, index) => {
        console.log(`헤더 ${index}:`, header.getAttribute('data-sort'));
        
        // 기존 이벤트 리스너 제거
        if (header.yearlySortHandler) {
            header.removeEventListener('click', header.yearlySortHandler);
        }
        
        // 새 이벤트 리스너 추가
        header.yearlySortHandler = function() {
            const sortColumn = this.getAttribute('data-sort');
            console.log('정렬 버튼 클릭:', sortColumn);
            sortYearlyTableByColumn(sortColumn);
        };
        header.addEventListener('click', header.yearlySortHandler);
    });
    
    console.log('정렬 이벤트 리스너 초기화 완료');
}

// 비교탭 테이블 정렬 함수
function sortCompareTableByColumn(column) {
    if (!compareOriginalTableData.length) {
        return;
    }
    
    // 같은 컬럼을 클릭하면 방향 토글, 다른 컬럼이면 내림차순으로 시작
    if (compareCurrentSort.column === column) {
        compareCurrentSort.direction = compareCurrentSort.direction === 'desc' ? 'asc' : 'desc';
    } else {
        compareCurrentSort.column = column;
        compareCurrentSort.direction = 'desc';
    }
    
    // 헤더 스타일 업데이트
    updateCompareSortHeaders();
    
    // 데이터 정렬
    const sortedData = [...compareOriginalTableData].sort((a, b) => {
        let aVal, bVal;
        
        switch(column) {
            case 'crop':
                aVal = a.crop;
                bVal = b.crop;
                return compareCurrentSort.direction === 'asc' ? 
                    aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            case 'nationalValue':
                aVal = a.nationalValue;
                bVal = b.nationalValue;
                return compareCurrentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
            case 'gangwonValue':
                aVal = a.gangwonValue;
                bVal = b.gangwonValue;
                return compareCurrentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
            case 'difference':
                aVal = a.difference;
                bVal = b.difference;
                return compareCurrentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
            case 'ratio':
                aVal = a.nationalValue > 0 ? ((a.difference / a.nationalValue) * 100) : 0;
                bVal = b.nationalValue > 0 ? ((b.difference / b.nationalValue) * 100) : 0;
                return compareCurrentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
            default:
                return 0;
        }
    });
    
    // 테이블 업데이트
    renderCompareTableWithData(sortedData);
}

// 비교탭 헤더 정렬 표시 업데이트
function updateCompareSortHeaders() {
    const headers = document.querySelectorAll('#compare .summary-data-table th.sortable');
    headers.forEach(header => {
        header.classList.remove('asc', 'desc');
        if (header.getAttribute('data-sort') === compareCurrentSort.column) {
            header.classList.add(compareCurrentSort.direction);
        }
    });
}

// 비교탭 정렬된 데이터로 테이블 렌더링
function renderCompareTableWithData(data) {
    const tableBody = document.getElementById('compareCropIncomeTableBody');
    if (!tableBody) return;
    
    let html = '';
    data.forEach(item => {
        const nationalValueFormatted = item.nationalValue.toLocaleString();
        const gangwonValueFormatted = item.gangwonValue.toLocaleString();
        const differenceFormatted = Math.abs(item.difference).toLocaleString();
        const ratio = item.nationalValue > 0 ? ((item.gangwonValue / item.nationalValue) * 100) : 0;
        const changeRate = ratio === 0 ? 0 : ratio - 100;
        const ratioDisplay = ratio === 0 ? '-' : 
            changeRate > 0 ? `▲ +${changeRate.toFixed(1)}` : 
            changeRate < 0 ? `▼ ${changeRate.toFixed(1)}` : `0.0`;
        
        const differenceColor = item.difference > 0 ? '#dc2626' : item.difference < 0 ? '#1e40af' : '#6b7280';
        const ratioColor = changeRate > 0 ? '#dc2626' : changeRate < 0 ? '#1e40af' : '#6b7280';
        
        html += `
            <tr>
                <td>${item.crop}</td>
                <td>${nationalValueFormatted}</td>
                <td>${gangwonValueFormatted}</td>
                <td style="color: ${differenceColor};">${differenceFormatted}</td>
                <td style="color: ${ratioColor};">${ratioDisplay}</td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html || '<tr><td colspan="5">데이터가 없습니다.</td></tr>';
}

// 비교탭 정렬 이벤트 리스너 초기화
function initializeCompareTableSorting() {
    // 비교탭 테이블의 정렬 가능한 헤더들 찾기
    const tableContainer = document.querySelector('#compare .income-table .table-container');
    if (!tableContainer) {
        return;
    }
    
    const sortableHeaders = tableContainer.querySelectorAll('th.sortable');
    
    if (sortableHeaders.length === 0) {
        return;
    }
    
    sortableHeaders.forEach((header) => {
        // 기존 이벤트 리스너 제거
        if (header.compareSortHandler) {
            header.removeEventListener('click', header.compareSortHandler);
        }
        
        // 새 이벤트 리스너 추가
        header.compareSortHandler = function() {
            const sortColumn = this.getAttribute('data-sort');
            sortCompareTableByColumn(sortColumn);
        };
        header.addEventListener('click', header.compareSortHandler);
    });
}

// 평년탭 강원 평년 TOP 5 업데이트
function updateYearlyTop5List() {
    const container = document.getElementById('yearlyTop5Container');
    const titleElement = document.getElementById('yearlyTop5Title');
    const categoryFilter = document.getElementById('yearlyTop5CategoryFilter');
    
    if (!container || !categoryFilter) return;
    
    const selectedCategory = categoryFilter.value;
    
    // 제목과 단위 업데이트
    if (titleElement) {
        const unit = getYearlyTop5Unit(selectedCategory);
        titleElement.innerHTML = `강원 평년 ${selectedCategory} TOP5<span class="unit-text">(${unit})</span>`;
    }
    
    // 강원 평년 데이터 필터링 (csvData2에서)
    const gangwonYearlyData = csvData2.filter(item => 
        item.region === '강원' && 
        item.category === selectedCategory &&
        item.crop && 
        item.crop !== '전체' &&
        item.value > 0
    );
    
    if (gangwonYearlyData.length === 0) {
        container.innerHTML = '<div class="loading-item">데이터가 없습니다</div>';
        return;
    }
    
    // kg당 생산비는 낮은 값이 좋으므로 오름차순, 나머지는 내림차순 정렬
    const isKgCost = selectedCategory === 'kg당 생산비';
    const sortedData = gangwonYearlyData
        .sort((a, b) => isKgCost ? a.value - b.value : b.value - a.value)
        .slice(0, 5);
    
    // 단위 결정
    let unit = '';
    if (['총수입', '경영비', '소득'].includes(selectedCategory)) {
        unit = '';  // 이미 ₩ 포함해서 표시
    } else if (['소득률'].includes(selectedCategory)) {
        unit = '%';
    } else if (['노동생산성', '자본생산성', '토지생산성'].includes(selectedCategory)) {
        unit = '';
    } else if (['kg당 생산비'].includes(selectedCategory)) {
        unit = '';  // 이미 ₩ 포함해서 표시
    }
    
    const html = sortedData.map((item, index) => {
        let displayValue = '';
        if (['총수입', '경영비', '소득', 'kg당 생산비'].includes(selectedCategory)) {
            displayValue = `${item.value.toLocaleString()}${unit}`;
        } else if (selectedCategory === '소득률') {
            displayValue = `${item.value.toFixed(1)}${unit}`;
        } else {
            displayValue = `${item.value.toLocaleString()}${unit}`;
        }
        
        return `
            <div class="top5-item">
                <div class="rank-number">${index + 1}</div>
                <div class="crop-info">
                    <div class="crop-name">${item.crop}</div>
                    <div class="crop-group">${item.cropGroup}</div>
                </div>
                <div class="crop-value">${displayValue}</div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

// 평년탭 전국 평년 TOP 5 업데이트
function updateYearlyNationalTop5List() {
    const container = document.getElementById('yearlyNationalTop5Container');
    const titleElement = document.getElementById('yearlyNationalTop5Title');
    const categoryFilter = document.getElementById('yearlyNationalTop5CategoryFilter');
    
    if (!container || !categoryFilter) return;
    
    const selectedCategory = categoryFilter.value;
    
    // 제목과 단위 업데이트
    if (titleElement) {
        const unit = getYearlyTop5Unit(selectedCategory);
        titleElement.innerHTML = `전국 평년 ${selectedCategory} TOP5<span class="unit-text">(${unit})</span>`;
    }
    
    // 전국 평년 데이터 필터링 (csvData2에서)
    const nationalYearlyData = csvData2.filter(item => 
        item.region === '전국' && 
        item.category === selectedCategory &&
        item.crop && 
        item.crop !== '전체' &&
        item.value > 0
    );
    
    if (nationalYearlyData.length === 0) {
        container.innerHTML = '<div class="loading-item">데이터가 없습니다</div>';
        return;
    }
    
    // kg당 생산비는 낮은 값이 좋으므로 오름차순, 나머지는 내림차순 정렬
    const isKgCost = selectedCategory === 'kg당 생산비';
    const sortedData = nationalYearlyData
        .sort((a, b) => isKgCost ? a.value - b.value : b.value - a.value)
        .slice(0, 5);
    
    // 단위 결정
    let unit = '';
    if (['총수입', '경영비', '소득'].includes(selectedCategory)) {
        unit = '';  // 이미 ₩ 포함해서 표시
    } else if (['소득률'].includes(selectedCategory)) {
        unit = '%';
    } else if (['노동생산성', '자본생산성', '토지생산성'].includes(selectedCategory)) {
        unit = '';
    } else if (['kg당 생산비'].includes(selectedCategory)) {
        unit = '';  // 이미 ₩ 포함해서 표시
    }
    
    const html = sortedData.map((item, index) => {
        let displayValue = '';
        if (['총수입', '경영비', '소득', 'kg당 생산비'].includes(selectedCategory)) {
            displayValue = `${item.value.toLocaleString()}${unit}`;
        } else if (selectedCategory === '소득률') {
            displayValue = `${item.value.toFixed(1)}${unit}`;
        } else {
            displayValue = `${item.value.toLocaleString()}${unit}`;
        }
        
        return `
            <div class="top5-item">
                <div class="rank-number">${index + 1}</div>
                <div class="crop-info">
                    <div class="crop-name">${item.crop}</div>
                    <div class="crop-group">${item.cropGroup}</div>
                </div>
                <div class="crop-value">${displayValue}</div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

// 평년탭 작목군 드롭다운 초기화
function initializeYearlyCropGroupFilter() {
    const cropGroupFilter = document.getElementById('yearlyCropGroupFilter');
    if (!cropGroupFilter) return;
    
    const comparisonMode = yearlyFilters.comparisonMode;
    
    // 비교 모드에 따른 데이터 소스 결정
    let dataSource = [];
    if (comparisonMode === 'gangwon-yearly-vs-current') {
        dataSource = [...csvData2, ...csvData].filter(item => 
            item.region === '강원' && item.category === '소득'
        );
    } else if (comparisonMode === 'national-vs-gangwon-yearly') {
        dataSource = csvData2.filter(item => item.category === '소득');
    } else if (comparisonMode === 'national-yearly-vs-gangwon-current') {
        dataSource = [...csvData2, ...csvData].filter(item => 
            item.category === '소득'
        );
    } else if (comparisonMode === 'national-yearly-vs-current') {
        dataSource = [...csvData2, ...csvData].filter(item => 
            item.region === '전국' && item.category === '소득'
        );
    }
    
    // 작목군 수집
    const cropGroups = new Set();
    dataSource.forEach(item => {
        if (item.cropGroup && item.crop && item.crop !== '전체') {
            cropGroups.add(item.cropGroup);
        }
    });
    
    // 드롭다운 옵션 업데이트
    const currentValue = cropGroupFilter.value;
    cropGroupFilter.innerHTML = '<option value="all">전체 작목군</option>';
    
    Array.from(cropGroups).sort().forEach(cropGroup => {
        const option = document.createElement('option');
        option.value = cropGroup;
        option.textContent = cropGroup;
        cropGroupFilter.appendChild(option);
    });
    
    // 이전 선택값 복원 (가능한 경우)
    if (Array.from(cropGroups).includes(currentValue)) {
        cropGroupFilter.value = currentValue;
    } else {
        cropGroupFilter.value = 'all';
    }
}

function updateMainComparisonChart() {
    const chartType = document.getElementById('chartTypeSelector')?.value || 'income';
    const region = summaryFilters.region;
    const year = summaryFilters.year;
    
    let categoryName;
    switch(chartType) {
        case 'income': categoryName = '소득'; break;
        case 'labor': categoryName = '노동생산성'; break;
        case 'capital': categoryName = '자본생산성'; break;
        case 'land': categoryName = '토지생산성'; break;
        default: categoryName = '소득';
    }
    
    // 차트 제목 업데이트
    const chartTitle = document.querySelector('.chart-title');
    if (chartTitle) {
        chartTitle.textContent = `${year}년 ${region} 작목군별 ${categoryName} 비교`;
    }
    
    // 작목군별 데이터 수집
    const cropGroups = ['과수', '일반작물', '노지채소', '시설채소'];
    const chartData = [];
    
    cropGroups.forEach(cropGroup => {
        const groupData = csvData.filter(item =>
            item.region === region &&
            item.year === year &&
            item.cropGroup === cropGroup &&
            item.category === categoryName &&
            item.crop && item.crop !== '전체'
        );
        
        if (groupData.length > 0) {
            // 해당 작목군에서 가장 높은 값
            const maxValue = Math.max(...groupData.map(item => item.value));
            chartData.push({ group: cropGroup, value: maxValue });
        } else {
            chartData.push({ group: cropGroup, value: 0 });
        }
    });
    
    const ctx = document.getElementById('mainComparisonChart')?.getContext('2d');
    if (!ctx) return;
    
    if (charts['mainComparisonChart']) charts['mainComparisonChart'].destroy();
    
    charts['mainComparisonChart'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.map(item => item.group),
            datasets: [{
                label: categoryName,
                data: chartData.map(item => item.value),
                backgroundColor: [
                    'rgba(30, 64, 175, 0.8)',
                    'rgba(59, 130, 246, 0.8)', 
                    'rgba(96, 165, 250, 0.8)',
                    'rgba(147, 197, 253, 0.8)'
                ],
                borderColor: 'transparent',
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    formatter: value => value.toLocaleString(),
                    font: { size: 12, weight: 'bold'},
                    color: '#1e40af'
                },
                tooltip: {
                    backgroundColor: 'rgba(30, 64, 175, 0.95)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#1e40af',
                    borderWidth: 2,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed.y.toLocaleString();
                            let unit = '';
                            
                            // 카테고리에 따라 단위 결정
                            if (categoryName.includes('소득') || categoryName.includes('수입') || categoryName.includes('비용')) {
                                unit = '원';
                            } else if (categoryName.includes('생산성') && categoryName.includes('노동')) {
                                unit = '원/시간';
                            } else if (categoryName.includes('생산성') && categoryName.includes('자본')) {
                                unit = '원/원';
                            } else if (categoryName.includes('생산성') && categoryName.includes('토지')) {
                                unit = '원/10a';
                            } else if (categoryName.includes('률') || categoryName.includes('비율')) {
                                unit = '%';
                            } else if (categoryName.includes('수량')) {
                                unit = 'kg';
                            } else if (categoryName.includes('가격')) {
                                unit = '원/kg';
                            } else if (categoryName.includes('시간')) {
                                unit = '시간';
                            } else if (/^\d+$/.test(value.replace(/,/g, ''))) {
                                // 순수 숫자인 경우 원 단위 추가
                                unit = '원';
                            }
                            
                            return categoryName + ': ' + value + unit;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { 
                        color: 'rgba(0, 0, 0, 0.1)',
                        drawBorder: false
                    },
                    ticks: {
                        font: { size: 11 },
                        color: '#64748b',
                        callback: function(value) {
                            if (value >= 1000000) {
                                return (value / 1000000).toFixed(1) + 'M';
                            } else if (value >= 1000) {
                                return (value / 1000).toFixed(1) + 'K';
                            } else {
                                return value;
                            }
                        }
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 12, weight: 'bold' },
                        color: '#1e40af'
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

function updateSummaryDataTable() {
    const region = summaryFilters.region;
    const year = summaryFilters.year;
    const selectedCropGroup = document.getElementById('cropGroupFilter')?.value || 'all';
    
    // 작목군 드롭다운 업데이트
    updateCropGroupFilter();
    
    // 모든 작목 데이터 수집 (작목군 필터 적용)
    const crops = new Set();
    csvData.forEach(item => {
        if (item.region === region && item.year === year && item.crop && item.crop !== '전체') {
            if (selectedCropGroup === 'all' || item.cropGroup === selectedCropGroup) {
                crops.add(item.crop);
            }
        }
    });
    
    const tableData = [];
    
    crops.forEach(crop => {
        const cropData = csvData.filter(item => 
            item.region === region && 
            item.year === year && 
            item.crop === crop
        );
        
        const cropGroup = cropData.length > 0 ? cropData[0].cropGroup : '';
        const income = cropData.find(item => item.category === '소득')?.value || 0;
        const laborProductivity = cropData.find(item => item.category === '노동생산성')?.value || 0;
        const capitalProductivity = cropData.find(item => item.category === '자본생산성')?.value || 0;
        
        // kg당 생산비를 DB에서 직접 가져오기
        const landProductivity = cropData.find(item => item.category === 'kg당 생산비')?.value || 0;
        
        tableData.push({
            cropGroup,
            crop,
            income,
            laborProductivity,
            capitalProductivity,
            landProductivity
        });
    });
    
    // 각 카테고리별로 순위 계산
    const incomeRanked = [...tableData].sort((a, b) => b.income - a.income);
    const laborRanked = [...tableData].sort((a, b) => b.laborProductivity - a.laborProductivity);
    const capitalRanked = [...tableData].sort((a, b) => b.capitalProductivity - a.capitalProductivity);
    const landRanked = [...tableData].sort((a, b) => a.landProductivity - b.landProductivity); // kg당 생산비는 낮을수록 좋음
    
    // 각 작목에 순위 정보 추가
    tableData.forEach(item => {
        item.incomeRank = incomeRanked.findIndex(ranked => ranked.crop === item.crop) + 1;
        item.laborRank = laborRanked.findIndex(ranked => ranked.crop === item.crop) + 1;
        item.capitalRank = capitalRanked.findIndex(ranked => ranked.crop === item.crop) + 1;
        item.landRank = landRanked.findIndex(ranked => ranked.crop === item.crop) + 1;
    });
    
    // 원본 데이터 저장 (정렬용)
    originalTableData = [...tableData];
    
    // 소득순으로 정렬
    tableData.sort((a, b) => b.income - a.income);
    
    // 테이블 업데이트
    const tbody = document.getElementById('summaryTableBody');
    if (!tbody) return;
    
    if (tableData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="loading-cell">데이터가 없습니다</td></tr>';
        return;
    }
    
    // 정렬 상태 초기화
    currentSort = { column: null, direction: 'desc' };
    updateSortHeaders();
    
    updateTableDisplay(tableData);
    
    // 테이블 업데이트 후 이벤트 리스너 재연결
    setTimeout(() => {
        initializeSummaryEventListeners();
    }, 100);
}

// 테이블 정렬 변수
let currentSort = { column: null, direction: 'desc' };
let originalTableData = [];

// 작목군 필터 업데이트 함수
function updateCropGroupFilter() {
    const region = summaryFilters.region;
    const year = summaryFilters.year;
    const cropGroupFilter = document.getElementById('cropGroupFilter');
    
    if (!cropGroupFilter) return;
    
    // 현재 선택된 값 저장
    const compareValue = cropGroupFilter.value;
    
    // 작목군 수집
    const cropGroups = new Set();
    csvData.forEach(item => {
        if (item.region === region && item.year === year && item.cropGroup && item.crop && item.crop !== '전체') {
            cropGroups.add(item.cropGroup);
        }
    });
    
    // 드롭다운 옵션 업데이트
    cropGroupFilter.innerHTML = '<option value="all">전체 작목군</option>';
    
    Array.from(cropGroups).sort().forEach(cropGroup => {
        const option = document.createElement('option');
        option.value = cropGroup;
        option.textContent = cropGroup;
        cropGroupFilter.appendChild(option);
    });
    
    // 이전 선택값 복원 (가능한 경우)
    if (Array.from(cropGroups).includes(compareValue)) {
        cropGroupFilter.value = compareValue;
    } else {
        cropGroupFilter.value = 'all';
    }
}

// 테이블 이벤트 리스너 추가
function initializeSummaryEventListeners() {
    // 작목군 필터 이벤트 리스너
    const cropGroupFilter = document.getElementById('cropGroupFilter');
    if (cropGroupFilter) {
        cropGroupFilter.removeEventListener('change', cropGroupFilter.changeHandler);
        cropGroupFilter.changeHandler = function() {
            updateSummaryDataTable();
        };
        cropGroupFilter.addEventListener('change', cropGroupFilter.changeHandler);
    }
    
    // 기존 이벤트 리스너 제거 후 새로 추가
    const headers = document.querySelectorAll('.summary-data-table th.sortable');
    headers.forEach(header => {
        // 기존 이벤트 리스너 제거
        header.removeEventListener('click', header.sortHandler);
        
        // 새 이벤트 리스너 추가
        header.sortHandler = function() {
            const sortColumn = this.getAttribute('data-sort');
            console.log('정렬 클릭:', sortColumn); // 디버깅용
            sortSummaryTableByColumn(sortColumn);
        };
        header.addEventListener('click', header.sortHandler);
    });
}

// 컬럼별 정렬 함수
function sortSummaryTableByColumn(column) {
    if (!originalTableData.length) return;
    
    // 같은 컬럼을 클릭하면 방향 토글, 다른 컬럼이면 내림차순으로 시작
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'desc' ? 'asc' : 'desc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'desc';
    }
    
    // 헤더 스타일 업데이트
    updateSortHeaders();
    
    // 데이터 정렬
    const sortedData = [...originalTableData].sort((a, b) => {
        let aVal, bVal;
        
        switch(column) {
            case 'cropGroup':
                aVal = a.cropGroup;
                bVal = b.cropGroup;
                return currentSort.direction === 'asc' ? 
                    aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            case 'crop':
                aVal = a.crop;
                bVal = b.crop;
                return currentSort.direction === 'asc' ? 
                    aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            case 'income':
                aVal = a.income;
                bVal = b.income;
                return currentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
            case 'incomeRank':
                aVal = a.incomeRank;
                bVal = b.incomeRank;
                return currentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
            case 'laborProductivity':
                aVal = a.laborProductivity;
                bVal = b.laborProductivity;
                return currentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
            case 'laborRank':
                aVal = a.laborRank;
                bVal = b.laborRank;
                return currentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
            case 'capitalProductivity':
                aVal = a.capitalProductivity;
                bVal = b.capitalProductivity;
                return currentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
            case 'capitalRank':
                aVal = a.capitalRank;
                bVal = b.capitalRank;
                return currentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
            case 'landProductivity':
                aVal = a.landProductivity;
                bVal = b.landProductivity;
                return currentSort.direction === 'asc' ? aVal - bVal : bVal - aVal; // kg당 생산비는 낮을수록 좋음
            case 'landRank':
                aVal = a.landRank;
                bVal = b.landRank;
                return currentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
            default:
                return 0;
        }
    });
    
    // 테이블 업데이트
    updateTableDisplay(sortedData);
}

// 헤더 정렬 표시 업데이트
function updateSortHeaders() {
    const headers = document.querySelectorAll('.summary-data-table th.sortable');
    headers.forEach(header => {
        header.classList.remove('asc', 'desc');
        if (header.getAttribute('data-sort') === currentSort.column) {
            header.classList.add(currentSort.direction);
        }
    });
}

// 테이블 표시 업데이트
function updateTableDisplay(data) {
    const tbody = document.getElementById('summaryTableBody');
    if (!tbody) return;
    
    // 순위를 메달 이모티콘 또는 숫자로 변환하는 함수
    function getRankDisplay(rank) {
        switch(rank) {
            case 1: return '🥇';
            case 2: return '🥈';
            case 3: return '🥉';
            default: return rank;
        }
    }
    
    tbody.innerHTML = data.map((item) => `
        <tr>
            <td>${item.crop}</td>
            <td>${item.income.toLocaleString()}</td>
            <td><span class="rank-badge" data-rank="${item.incomeRank}">${getRankDisplay(item.incomeRank)}</span></td>
            <td>${item.laborProductivity.toLocaleString()}</td>
            <td><span class="rank-badge" data-rank="${item.laborRank}">${getRankDisplay(item.laborRank)}</span></td>
            <td>${item.capitalProductivity.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            <td><span class="rank-badge" data-rank="${item.capitalRank}">${getRankDisplay(item.capitalRank)}</span></td>
            <td>${item.landProductivity.toLocaleString()}</td>
            <td><span class="rank-badge" data-rank="${item.landRank}">${getRankDisplay(item.landRank)}</span></td>
        </tr>
    `).join('');
}

function filterSummaryTable() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const tbody = document.getElementById('summaryTableBody');
    if (!tbody) return;
    
    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => {
        const cropName = row.cells[0]?.textContent.toLowerCase() || '';
        
        if (cropName.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function sortSummaryTable() {
    const sortValue = document.getElementById('sortSelector')?.value || 'income-desc';
    const tbody = document.getElementById('summaryTableBody');
    if (!tbody) return;
    
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    rows.sort((a, b) => {
        let aVal, bVal;
        
        switch(sortValue) {
            case 'income-desc':
                aVal = parseFloat(a.cells[1]?.textContent.replace(/,/g, '') || '0');
                bVal = parseFloat(b.cells[1]?.textContent.replace(/,/g, '') || '0');
                return bVal - aVal;
            case 'income-asc':
                aVal = parseFloat(a.cells[1]?.textContent.replace(/,/g, '') || '0');
                bVal = parseFloat(b.cells[1]?.textContent.replace(/,/g, '') || '0');
                return aVal - bVal;
            case 'name-asc':
                aVal = a.cells[0]?.textContent || '';
                bVal = b.cells[0]?.textContent || '';
                return aVal.localeCompare(bVal);
            default:
                return 0;
        }
    });
    
    rows.forEach(row => tbody.appendChild(row));
}

function createProductivityChart(cropGroup, chartId, productivityType) {
    // 해당 작목군의 작목상세별 생산성 데이터 수집
    let cropData = csvData.filter(item => {
        return item.category === productivityType &&
               item.region === summaryFilters.region &&
               item.year === summaryFilters.year &&
               item.cropGroup === cropGroup &&
               item.crop && item.crop !== '전체';
    });
    
    // 생산성순으로 정렬하고 상위 5개 선택
    const sortedCrops = cropData
        .map(item => ({
            crop: item.crop,
            value: item.value
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
    
    const ctx = document.getElementById(chartId)?.getContext('2d');
    if (!ctx) return;
    
    if (charts[chartId]) charts[chartId].destroy();
    
    if (sortedCrops.length === 0) {
        // 데이터가 없을 경우 빈 차트
        charts[chartId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['데이터 없음'],
                datasets: [{
                    data: [0],
                    backgroundColor: 'rgba(200, 200, 200, 0.3)',
                    borderColor: 'transparent'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    datalabels: { display: false }
                },
                scales: {
                    y: { display: false },
                    x: { display: false }
                }
            }
        });
        return;
    }
    
    const maxValue = Math.max(...sortedCrops.map(item => item.value));
    
    charts[chartId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedCrops.map(item => item.crop),
            datasets: [{
                label: productivityType,
                data: sortedCrops.map(item => item.value),
                backgroundColor: sortedCrops.map(() => 
                    'rgba(30, 64, 175, 0.8)'
                ),
                borderColor: 'transparent',
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            indexAxis: 'y',
            maintainAspectRatio: false,
            layout: {
                padding: {
                    left: 30,
                    right: 30,
                    top: 5,
                    bottom: 5
                }
            },
            scales: {
                x: {
                    display: false,
                    grid: { display: false },
                    max: maxValue * 1.3
                },
                y: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 10, weight: 'bold' },
                        color: '#1e40af',
                        maxTicksLimit: 5
                    }
                }
            },
            plugins: {
                datalabels: {
                    anchor: 'end',
                    align: 'right',
                    formatter: value => value.toLocaleString(),
                    font: { size: 9, weight: 'bold'},
                    color: '#1e40af'
                },
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(30, 64, 175, 0.95)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#1e40af',
                    borderWidth: 2,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed.x.toLocaleString();
                            let unit = '';
                            
                            // 생산성 타입에 따라 단위 결정
                            if (productivityType.includes('노동생산성')) {
                                unit = '원/시간';
                            } else if (productivityType.includes('자본생산성')) {
                                unit = '%';
                            } else if (productivityType.includes('토지생산성')) {
                                unit = '원/3.3㎡';
                            } else {
                                unit = '원';
                            }
                            
                            return productivityType + ': ' + value + unit;
                        }
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

// 노동생산성 차트 함수들
function updateFruitLaborProductivityChart() {
    createProductivityChart('과수', 'fruitLaborProductivityChart', '노동생산성');
}

function updateGeneralLaborProductivityChart() {
    createProductivityChart('일반작물', 'generalLaborProductivityChart', '노동생산성');
}

function updateFieldLaborProductivityChart() {
    createProductivityChart('노지채소', 'fieldLaborProductivityChart', '노동생산성');
}

function updateGreenhouseLaborProductivityChart() {
    createProductivityChart('시설채소', 'greenhouseLaborProductivityChart', '노동생산성');
}

// 자본생산성 차트 함수들
function updateFruitCapitalProductivityChart() {
    createProductivityChart('과수', 'fruitCapitalProductivityChart', '자본생산성');
}

function updateGeneralCapitalProductivityChart() {
    createProductivityChart('일반작물', 'generalCapitalProductivityChart', '자본생산성');
}

function updateFieldCapitalProductivityChart() {
    createProductivityChart('노지채소', 'fieldCapitalProductivityChart', '자본생산성');
}

function updateGreenhouseCapitalProductivityChart() {
    createProductivityChart('시설채소', 'greenhouseCapitalProductivityChart', '자본생산성');
}

// 토지생산성 차트 함수들
function updateFruitLandProductivityChart() {
    createProductivityChart('과수', 'fruitLandProductivityChart', '토지생산성');
}

function updateGeneralLandProductivityChart() {
    createProductivityChart('일반작물', 'generalLandProductivityChart', '토지생산성');
}

function updateFieldLandProductivityChart() {
    createProductivityChart('노지채소', 'fieldLandProductivityChart', '토지생산성');
}

function updateGreenhouseLandProductivityChart() {
    createProductivityChart('시설채소', 'greenhouseLandProductivityChart', '토지생산성');
}

function updateSummaryProductivityChartTitles() {
    const year = summaryFilters.year;
    const region = summaryFilters.region;
    
    // 노동생산성 제목 업데이트
    document.getElementById('fruitLaborProductivityTitle').textContent = `${year}년 ${region} 과수 노동생산성`;
    document.getElementById('generalLaborProductivityTitle').textContent = `${year}년 ${region} 일반작물 노동생산성`;
    document.getElementById('fieldLaborProductivityTitle').textContent = `${year}년 ${region} 노지채소 노동생산성`;
    document.getElementById('greenhouseLaborProductivityTitle').textContent = `${year}년 ${region} 시설채소 노동생산성`;
    
    // 자본생산성 제목 업데이트
    document.getElementById('fruitCapitalProductivityTitle').textContent = `${year}년 ${region} 과수 자본생산성`;
    document.getElementById('generalCapitalProductivityTitle').textContent = `${year}년 ${region} 일반작물 자본생산성`;
    document.getElementById('fieldCapitalProductivityTitle').textContent = `${year}년 ${region} 노지채소 자본생산성`;
    document.getElementById('greenhouseCapitalProductivityTitle').textContent = `${year}년 ${region} 시설채소 자본생산성`;
    
    // 토지생산성 제목 업데이트
    document.getElementById('fruitLandProductivityTitle').textContent = `${year}년 ${region} 과수 토지생산성`;
    document.getElementById('generalLandProductivityTitle').textContent = `${year}년 ${region} 일반작물 토지생산성`;
    document.getElementById('fieldLandProductivityTitle').textContent = `${year}년 ${region} 노지채소 토지생산성`;
    document.getElementById('greenhouseLandProductivityTitle').textContent = `${year}년 ${region} 시설채소 토지생산성`;
}


// ========== 전역 함수 등록 (HTML에서 사용) ==========

// 사이드바 토글 함수를 전역으로 노출
window.toggleSidebar = toggleSidebar;

// 비교탭 사이드바 토글 함수
function toggleCompareSidebar() {
    const sidebar = document.getElementById('compareSidebar');
    const toggleBtn = document.querySelector('#compare .mobile-toggle-btn');
    
    if (!sidebar) {
        console.error('비교탭 사이드바를 찾을 수 없습니다.');
        return;
    }
    
    if (sidebar.classList.contains('expanded')) {
        // 축소
        sidebar.classList.remove('expanded');
        sidebar.classList.add('collapsed');
        // 배경 스크롤 활성화
        document.body.style.overflow = '';
        if (toggleBtn) {
            toggleBtn.textContent = '필터 ▼';
            toggleBtn.setAttribute('aria-expanded', 'false');
        }
    } else {
        // 확장
        sidebar.classList.remove('collapsed');
        sidebar.classList.add('expanded');
        // 배경 스크롤 차단
        document.body.style.overflow = 'hidden';
        if (toggleBtn) {
            toggleBtn.textContent = '필터 ▲';
            toggleBtn.setAttribute('aria-expanded', 'true');
        }
    }
}

window.toggleCompareSidebar = toggleCompareSidebar;

// 평년탭 사이드바 토글 함수
function toggleYearlySidebar() {
    const sidebar = document.getElementById('yearlySidebar');
    const toggleBtn = document.querySelector('#yearly .mobile-toggle-btn');
    
    if (!sidebar) {
        console.error('평년탭 사이드바를 찾을 수 없습니다.');
        return;
    }
    
    const isVisible = sidebar.classList.contains('visible');
    
    if (isVisible) {
        sidebar.classList.remove('visible');
        if (toggleBtn) toggleBtn.textContent = '필터';
    } else {
        sidebar.classList.add('visible');
        if (toggleBtn) toggleBtn.textContent = '닫기';
    }
}

window.toggleYearlySidebar = toggleYearlySidebar;

// 차트와 탭 상태를 전역으로 노출
window.charts = charts;
window.currentTab = currentTab;

// 탭 변경 시 currentTab 업데이트하는 함수
window.setCurrentTab = function(tabName) {
    currentTab = tabName;
    window.currentTab = currentTab;
    
    // 탭 변경 시 body 스크롤 복원 (사이드바가 확장되어 있을 수 있으므로)
    document.body.style.overflow = '';
    
    // 비교 탭이 활성화되면 비교 데이터 업데이트
    if (tabName === 'compare' && csvData.length > 0) {
        setTimeout(() => {
            updateCompareDisplay();
        }, 100);
    }
    
    // 요약 탭이 활성화되면 요약 데이터 업데이트
    if (tabName === 'summary' && csvData.length > 0) {
        setTimeout(() => {
            initializeSummaryFilters();
        }, 100);
    }
    
    // 평년 탭이 활성화되면 DB2 로딩 및 필터 초기화
    if (tabName === 'yearly') {
        if (csvData2.length === 0) {
            // DB2가 아직 로딩되지 않았으면 로딩
            loadCSV2FromGitHub();
        } else {
            // 이미 로딩되었으면 필터만 초기화
            setTimeout(() => {
                initializeYearlyFilters();
                // 정렬 기능도 초기화
                initializeYearlyTableSorting();
            }, 200);
        }
    }
};

// ========== 엑셀 내보내기 함수들 ==========

// 공통 엑셀 내보내기 함수
function exportToExcel(data, filename, sheetName = 'Sheet1') {
    try {
        // 출처 정보를 데이터 맨 앞에 추가
        const sourceInfo = [
            ['출처: 농촌진흥청 「농산물소득조사」를 재가공한 자료로, 참고용으로 활용하시기 바랍니다.'],
            ['자세한 사항은 농사로(https://www.nongsaro.go.kr) 및 통계청에서 확인하실 수 있습니다.'],
            [''] // 빈 줄로 구분
        ];
        
        // 출처 정보와 기존 데이터를 결합
        const finalData = [...sourceInfo, ...data];
        
        // 워크북 생성
        const wb = XLSX.utils.book_new();
        
        // 워크시트 생성
        const ws = XLSX.utils.aoa_to_sheet(finalData);
        
        // 워크시트를 워크북에 추가
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        
        // 파일 다운로드
        XLSX.writeFile(wb, filename);
    } catch (error) {
        console.error('엑셀 내보내기 오류:', error);
        alert('엑셀 파일 내보내기 중 오류가 발생했습니다.');
    }
}

// 테이블에서 데이터 추출 함수
function getTableData(tableElement) {
    const data = [];
    const rows = tableElement.querySelectorAll('tr');
    
    rows.forEach(row => {
        const rowData = [];
        const cells = row.querySelectorAll('th, td');
        cells.forEach(cell => {
            // 정렬 화살표 제거하고 텍스트만 추출
            let cellText = cell.textContent.replace(/[▲▼]/g, '').trim();
            
            // 순위 아이콘을 숫자로 변환 (🥇 → 1, 🥈 → 2, 🥉 → 3)
            cellText = cellText.replace(/🥇/g, '1')
                              .replace(/🥈/g, '2')
                              .replace(/🥉/g, '3');
            
            // 로딩 메시지 제외
            if (cellText === '데이터를 불러오는 중...' || cellText === '데이터를 불러오는 중' || cellText.includes('로딩')) {
                return;
            }
            rowData.push(cellText);
        });
        if (rowData.length > 0 && rowData.some(cell => cell !== '')) {
            data.push(rowData);
        }
    });
    
    return data;
}

// 요약탭 상세 조회 테이블 내보내기
function exportSummaryTableToExcel() {
    const table = document.querySelector('.summary-data-table');
    if (!table) {
        alert('테이블을 찾을 수 없습니다.');
        return;
    }
    
    const data = getTableData(table);
    const currentDate = new Date().toISOString().slice(0, 10);
    const filename = `요약탭_상세조회_${currentDate}.xlsx`;
    
    exportToExcel(data, filename, '상세조회');
}

// 작목별 조회탭 소득분석표 내보내기
function exportStatusAnalysisToExcel() {
    const table = document.querySelector('.income-analysis-layout table');
    if (!table) {
        alert('테이블을 찾을 수 없습니다.');
        return;
    }
    
    const data = getTableData(table);
    const title = document.getElementById('summaryTitle').textContent;
    const currentDate = new Date().toISOString().slice(0, 10);
    const filename = `작목별조회_소득분석_${currentDate}.xlsx`;
    
    // 타이틀 추가
    data.unshift([title]);
    data.unshift(['']); // 빈 행 추가
    
    exportToExcel(data, filename, '소득분석');
}

// 전국 vs 강원탭 비교 분석표 내보내기
function exportCompareAnalysisToExcel() {
    const table = document.querySelector('#compare .income-analysis-layout table');
    if (!table) {
        alert('테이블을 찾을 수 없습니다.');
        return;
    }
    
    const data = getTableData(table);
    const title = document.getElementById('compareSummaryTitle').textContent;
    const currentDate = new Date().toISOString().slice(0, 10);
    const filename = `전국vs강원_비교분석_${currentDate}.xlsx`;
    
    // 타이틀 추가
    data.unshift([title]);
    data.unshift(['']); // 빈 행 추가
    
    exportToExcel(data, filename, '비교분석');
}

// 전국 vs 강원탭 작목별 소득표 내보내기
function exportCompareIncomeTableToExcel() {
    const table = document.querySelector('.income-table table');
    if (!table) {
        alert('테이블을 찾을 수 없습니다.');
        return;
    }
    
    const data = getTableData(table);
    const title = document.getElementById('compareCropIncomeTitle').textContent;
    const currentDate = new Date().toISOString().slice(0, 10);
    const filename = `전국vs강원_작목별소득_${currentDate}.xlsx`;
    
    // 타이틀 추가
    data.unshift([title]);
    data.unshift(['']); // 빈 행 추가
    
    exportToExcel(data, filename, '작목별소득');
}

// 평년탭 작목별 소득표 내보내기
function exportYearlyIncomeTableToExcel() {
    const table = document.querySelector('#yearly .income-table table');
    if (!table) {
        alert('테이블을 찾을 수 없습니다.');
        return;
    }
    
    const data = getTableData(table);
    const title = document.getElementById('yearlyCropIncomeTitle').textContent;
    const currentDate = new Date().toISOString().slice(0, 10);
    const filename = `평년_작목별소득_${currentDate}.xlsx`;
    
    // 타이틀 추가
    data.unshift([title]);
    data.unshift(['']); // 빈 행 추가
    
    exportToExcel(data, filename, '작목별소득');
}

// 평년탭 분석표 내보내기
function exportYearlyAnalysisToExcel() {
    const table = document.querySelector('.yearly-analysis-layout table');
    if (!table) {
        alert('테이블을 찾을 수 없습니다.');
        return;
    }
    
    const data = getTableData(table);
    const title = document.getElementById('yearlyAnalysisTitle').textContent;
    const currentDate = new Date().toISOString().slice(0, 10);
    const filename = `평년_분석표_${currentDate}.xlsx`;
    
    // 타이틀 추가
    data.unshift([title]);
    data.unshift(['']); // 빈 행 추가
    
    exportToExcel(data, filename, '분석표');
}

// 전역 함수로 노출
window.exportSummaryTableToExcel = exportSummaryTableToExcel;
window.exportStatusAnalysisToExcel = exportStatusAnalysisToExcel;
window.exportCompareAnalysisToExcel = exportCompareAnalysisToExcel;
window.exportCompareIncomeTableToExcel = exportCompareIncomeTableToExcel;
window.exportYearlyIncomeTableToExcel = exportYearlyIncomeTableToExcel;
window.exportYearlyAnalysisToExcel = exportYearlyAnalysisToExcel;

// ========== 앱 시작 ==========

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}