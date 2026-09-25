/**
 * 預編譯標頭入口
 *
 * 集中載入範例常用的標準函式庫與 AV 視覺化介面，供編譯服務建立 pch.hpp.gch 以
 * 降低每次範例編譯的前置成本。此檔只管理相依性，不應放入具有執行期副作用的程式。
 * 新增標頭時需確認所有支援的編譯器皆可用，且不得提交產生出的 .gch 二進位檔。
 */

#ifndef PCH_HPP
#define PCH_HPP

// 包含所有常用的重量級標頭檔
#include <iostream>
#include <string>
#include <vector>
#include <map>
#include <set>
#include <queue>
#include <algorithm>
#include <cmath>
#include <functional>
#include <tuple>

// 包含您的核心引擎
#include "AV.hpp"

#endif // PCH_HPP
